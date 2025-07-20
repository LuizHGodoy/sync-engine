import { AppState, AppStateStatus } from "react-native";
import { ConflictResolver, ConflictStrategies } from "./conflictResolver";
import { NetMonitor } from "./netMonitor";
import { OutboxOperation, OutboxStatus, QueueStorage } from "./queueStorage";
import { RetryPolicies, RetryPolicy } from "./retryPolicy";
import {
  BatchSyncResult,
  QueueItem,
  ServerResponse,
  SyncConfig,
  SyncEngineOptions,
  SyncEvent,
  SyncEventListener,
  SyncStatus,
} from "./types";

interface MemoryCache {
  pendingItems: Map<string, QueueItem>;
  stats: {
    pending: number;
    synced: number;
    error: number;
    total: number;
  } | null;
  lastStatsUpdate: number;
}

interface ConnectionPool {
  maxConnections: number;
  activeConnections: number;
  queue: Array<() => void>;
}

export class SyncEngine {
  private storage: QueueStorage;
  private netMonitor: NetMonitor;
  private retryPolicy: RetryPolicy;
  private conflictResolver: ConflictResolver;
  private config: SyncConfig;
  private hooks: SyncEngineOptions["hooks"];
  private debug: boolean;

  private memoryCache: MemoryCache;
  private connectionPool: ConnectionPool;
  private syncWorkerPool: Array<Promise<void>>;
  private abortController: AbortController;
  private eventListenersMap: Map<string, Set<SyncEventListener>>;

  private isInitialized: boolean = false;
  private isSyncing: boolean = false;
  private isActive: boolean = false;
  private lastSync?: number;
  private syncInterval?: NodeJS.Timeout;
  private listeners: SyncEventListener[] = [];
  private appStateSubscription?: { remove: () => void };

  constructor(options: SyncEngineOptions) {
    this.config = {
      maxConcurrentRequests: 3,
      enableBatchSync: true,
      cacheExpiration: 30000,
      ...options.config,
    };
    this.hooks = options.hooks;
    this.debug = options.debug || false;

    this.memoryCache = {
      pendingItems: new Map(),
      stats: null,
      lastStatsUpdate: 0,
    };

    this.connectionPool = {
      maxConnections: this.config.maxConcurrentRequests || 3,
      activeConnections: 0,
      queue: [],
    };

    this.syncWorkerPool = [];
    this.abortController = new AbortController();
    this.eventListenersMap = new Map();

    this.storage = new QueueStorage();
    this.netMonitor = new NetMonitor();
    this.retryPolicy = RetryPolicies.default();
    this.conflictResolver = new ConflictResolver(
      options.conflictStrategy || ConflictStrategies.timestampWins()
    );

    this.setupRetryPolicy();
    this.bindMethods();
  }

  private outboxToQueueItem(operation: OutboxOperation): QueueItem {
    const status =
      operation.status === "pending" || operation.status === "failed"
        ? "pending"
        : operation.status === "syncing"
        ? "pending"
        : operation.status === "synced"
        ? "synced"
        : "error";

    return {
      id: operation.id,
      type: operation.entity_table,
      payload: JSON.parse(operation.data || "{}"),
      status,
      retries: operation.retry_count,
      lastTriedAt: operation.updated_at,
      createdAt: operation.created_at,
      updatedAt: operation.updated_at,
    };
  }

  private queueItemToOutbox(
    item: QueueItem,
    entityId: string
  ): {
    entityTable: string;
    entityId: string;
    operation: "CREATE" | "UPDATE" | "DELETE";
    data: any;
  } {
    const operation = item.payload._operation || "UPDATE";

    return {
      entityTable: item.type,
      entityId,
      operation,
      data: item.payload,
    };
  }

  private async updateOperationStatus(
    operationId: string,
    status: "synced" | "error",
    errorMessage?: string
  ): Promise<void> {
    const outboxStatus: OutboxStatus =
      status === "synced" ? "synced" : "failed";
    await this.storage.updateOperationStatus(
      operationId,
      outboxStatus,
      errorMessage
    );
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.log("Initializing Sync Engine...");

      await this.storage.initialize();
      await this.netMonitor.initialize();

      this.setupNetworkListener();
      this.setupAppStateListener();

      this.isInitialized = true;
      this.log("Sync Engine initialized successfully");
    } catch (error) {
      this.log("Error initializing Sync Engine:", error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.log("Starting automatic synchronization");

    if (this.netMonitor.getConnectionStatus()) {
      await this.forceSync();
    }
    this.setupSyncInterval();

    this.emitEvent("sync_started", { autoSync: true });
  }

  async getQueuedItems(): Promise<QueueItem[]> {
    if (!this.isInitialized) {
      this.log(
        "Warning: Sync Engine not initialized. Returning empty array."
      );
      return [];
    }

    const operations = await this.storage.getPendingOperations();
    return operations.map((op) => this.outboxToQueueItem(op));
  }

  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.log("Stopping automatic synchronization");

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    this.emitEvent("sync_started", { autoSync: false });
  }

  async addToQueue(
    id: string,
    type: string,
    payload: any,
    status: QueueItem["status"] = "pending"
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const item: QueueItem = {
        id,
        type,
        payload,
        status,
        retries: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const { entityTable, entityId, operation, data } = this.queueItemToOutbox(
        item,
        id
      );
      await this.storage.addOperation(entityTable, entityId, operation, data);

      if (status === "pending") {
        this.memoryCache.pendingItems.set(id, item);
      }
      this.invalidateCache();

      this.log(`Item added to queue: ${id} (${type})`);
      this.emitEvent("item_queued", { id, type, payload });

      await this.executeHook("onQueueChange", await this.getStatus());

      if (
        this.isActive &&
        this.netMonitor.getConnectionStatus() &&
        !this.isSyncing
      ) {
        queueMicrotask(() => this.forceSync());
      }
    } catch (error) {
      this.log("Error adding item to queue:", error);
      throw error;
    }
  }

  async forceSync(): Promise<BatchSyncResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isSyncing) {
      this.log("Sync already running, waiting...");
      await this.waitForSyncCompletion();
      return {
        success: true,
        syncedItems: 0,
        errors: 0,
        totalProcessed: 0,
        duration: 0,
      };
    }

    if (!this.netMonitor.getConnectionStatus()) {
      this.log("No connection, sync cancelled");
      return {
        success: false,
        syncedItems: 0,
        errors: 0,
        totalProcessed: 0,
        duration: 0,
      };
    }

    const startTime = Date.now();
    this.isSyncing = true;
    let syncedItems = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      this.log("Starting forced synchronization");
      this.emitEvent("sync_started");

      const pendingItems = await this.getCachedPendingItems(
        this.config.batchSize
      );

      if (pendingItems.length === 0) {
        this.log("No pending items to sync");
        return {
          success: true,
          syncedItems: 0,
          errors: 0,
          totalProcessed: 0,
          duration: Date.now() - startTime,
        };
      }

      this.log(`Synchronizing ${pendingItems.length} items`);
      await this.executeHook("onBeforeSync", pendingItems);

      if (this.config.enableBatchSync) {
        const result = await this.syncItemsBatch(pendingItems);
        syncedItems = result.syncedItems;
        errors = result.errors;
        totalProcessed = result.totalProcessed;
      } else {
        const result = await this.syncItemsConcurrent(pendingItems);
        syncedItems = result.syncedItems;
        errors = result.errors;
        totalProcessed = result.totalProcessed;
      }

      await this.executeHook("onSyncSuccess", pendingItems);
      this.lastSync = Date.now();

      this.invalidateCache();

      const duration = Date.now() - startTime;
      this.log(
        `Sync complete: ${syncedItems} synced, ${errors} errors in ${duration}ms`
      );

      this.emitEvent("sync_completed", { syncedItems, errors, duration });

      return {
        success: errors === 0,
        syncedItems,
        errors,
        totalProcessed,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log("Error during synchronization:", error);
      this.emitEvent("sync_failed", { error, duration });
      await this.executeHook("onSyncError", error, []);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private async getCachedPendingItems(limit?: number): Promise<QueueItem[]> {
    const now = Date.now();

    if (
      this.memoryCache.lastStatsUpdate +
        (this.config.cacheExpiration || 30000) >
      now
    ) {
      const cached = Array.from(this.memoryCache.pendingItems.values()).slice(
        0,
        limit
      );
      if (cached.length > 0) {
        return cached;
      }
    }

    const operations = await this.storage.getPendingOperations(limit);
    const items = operations.map((op) => this.outboxToQueueItem(op));
    this.updatePendingCache(items);
    return items;
  }

  private updatePendingCache(items: QueueItem[]): void {
    this.memoryCache.pendingItems.clear();
    items.forEach((item) => {
      this.memoryCache.pendingItems.set(item.id, item);
    });
    this.memoryCache.lastStatsUpdate = Date.now();
  }

  private invalidateCache(): void {
    this.memoryCache.pendingItems.clear();
    this.memoryCache.stats = null;
    this.memoryCache.lastStatsUpdate = 0;
  }

  private async syncItemsBatch(
    items: QueueItem[]
  ): Promise<{ syncedItems: number; errors: number; totalProcessed: number }> {
    const endpoint = `${this.config.serverUrl}/sync/batch`;
    let syncedItems = 0;
    let errors = 0;

    try {
      const response = await this.acquireConnection(() =>
        fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.config.headers,
          },
          body: JSON.stringify({
            items: items.map((item) => ({
              id: item.id,
              type: item.type,
              payload: item.payload,
              timestamp: item.updatedAt,
            })),
          }),
          signal: this.abortController.signal,
        })
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      for (const itemResult of result.results || []) {
        if (itemResult.success) {
          await this.updateOperationStatus(itemResult.id, "synced");
          syncedItems++;
          this.emitEvent("item_synced", {
            item: items.find((i) => i.id === itemResult.id),
          });
        } else {
          await this.updateOperationStatus(
            itemResult.id,
            "error",
            itemResult.error
          );
          errors++;
          this.emitEvent("item_failed", {
            item: items.find((i) => i.id === itemResult.id),
            error: new Error(itemResult.error),
          });
        }
      }
    } catch (error) {
      for (const item of items) {
        await this.updateOperationStatus(item.id, "error", error?.toString());
        errors++;
        this.emitEvent("item_failed", { item, error });
      }
    }

    return { syncedItems, errors, totalProcessed: items.length };
  }

  private async syncItemsConcurrent(
    items: QueueItem[]
  ): Promise<{ syncedItems: number; errors: number; totalProcessed: number }> {
    let syncedItems = 0;
    let errors = 0;

    const workers = [];
    const chunkSize = Math.ceil(
      items.length / (this.config.maxConcurrentRequests || 3)
    );

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const worker = this.processSyncChunk(chunk);
      workers.push(worker);
    }

    const results = await Promise.allSettled(workers);

    for (const result of results) {
      if (result.status === "fulfilled") {
        syncedItems += result.value.syncedItems;
        errors += result.value.errors;
      } else {
        errors += chunkSize;
      }
    }

    return { syncedItems, errors, totalProcessed: items.length };
  }

  private async processSyncChunk(
    items: QueueItem[]
  ): Promise<{ syncedItems: number; errors: number }> {
    let syncedItems = 0;
    let errors = 0;

    for (const item of items) {
      try {
        await this.syncItem(item);
        syncedItems++;
        this.emitEvent("item_synced", { item });
      } catch (error) {
        errors++;
        this.log(`Error syncing item ${item.id}:`, error);
        this.emitEvent("item_failed", { item, error });
      }
    }

    return { syncedItems, errors };
  }

  private async acquireConnection<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (
        this.connectionPool.activeConnections <
        this.connectionPool.maxConnections
      ) {
        this.connectionPool.activeConnections++;
        operation()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.connectionPool.activeConnections--;
            const next = this.connectionPool.queue.shift();
            if (next) next();
          });
      } else {
        this.connectionPool.queue.push(() => {
          this.connectionPool.activeConnections++;
          operation()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              this.connectionPool.activeConnections--;
              const next = this.connectionPool.queue.shift();
              if (next) next();
            });
        });
      }
    });
  }

  async getStatus(): Promise<SyncStatus> {
    if (!this.isInitialized) {
      return {
        isActive: false,
        pendingItems: 0,
        errorItems: 0,
        isOnline: false,
        isSyncing: false,
      };
    }

    const now = Date.now();
    if (
      this.memoryCache.stats &&
      this.memoryCache.lastStatsUpdate +
        (this.config.cacheExpiration || 30000) >
        now
    ) {
      return {
        isActive: this.isActive,
        lastSync: this.lastSync,
        pendingItems: this.memoryCache.stats.pending,
        errorItems: this.memoryCache.stats.error,
        isOnline: this.netMonitor.getConnectionStatus(),
        isSyncing: this.isSyncing,
      };
    }

    const stats = await this.storage.getQueueStats();

    const mappedStats = {
      pending: stats.pending,
      synced: stats.synced,
      error: stats.failed,
      total: stats.pending + stats.syncing + stats.failed + stats.synced,
    };

    this.memoryCache.stats = mappedStats;
    this.memoryCache.lastStatsUpdate = now;

    return {
      isActive: this.isActive,
      lastSync: this.lastSync,
      pendingItems: mappedStats.pending,
      errorItems: mappedStats.error,
      isOnline: this.netMonitor.getConnectionStatus(),
      isSyncing: this.isSyncing,
    };
  }

  public async getLocalQueueItems(): Promise<QueueItem[]> {
    if (!this.isInitialized) {
      return [];
    }

    if (this.memoryCache.pendingItems.size > 0) {
      return Array.from(this.memoryCache.pendingItems.values());
    }

    const operations = await this.storage.getPendingOperations();
    return operations.map((op) => this.outboxToQueueItem(op));
  }

  addEventListener(listener: SyncEventListener, eventTypes?: string[]): void {
    if (eventTypes && eventTypes.length > 0) {
      eventTypes.forEach((type) => {
        if (!this.eventListenersMap.has(type)) {
          this.eventListenersMap.set(type, new Set());
        }
        this.eventListenersMap.get(type)!.add(listener);
      });
    } else {
      this.listeners.push(listener);
    }
  }

  removeEventListener(
    listener: SyncEventListener,
    eventTypes?: string[]
  ): void {
    if (eventTypes && eventTypes.length > 0) {
      eventTypes.forEach((type) => {
        const listeners = this.eventListenersMap.get(type);
        if (listeners) {
          listeners.delete(listener);
          if (listeners.size === 0) {
            this.eventListenersMap.delete(type);
          }
        }
      });
    } else {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    }
  }

  async clearSyncedItems(): Promise<void> {
    await this.storage.cleanupSyncedOperations(0);
    this.log("Synced items removed");
  }

  async retryFailedItems(): Promise<void> {
    const failedCount = await this.storage.resetFailedOperations();
    this.log(`${failedCount} failed items marked for retry`);

    if (this.isActive && this.netMonitor.getConnectionStatus()) {
      await this.forceSync();
    }
  }

  async destroy(): Promise<void> {
    this.log("Finalizando Sync Engine");

    this.stop();

    this.abortController.abort();

    if (this.syncWorkerPool.length > 0) {
      await Promise.allSettled(this.syncWorkerPool);
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.netMonitor.destroy();
    await this.storage.close();

    this.listeners = [];
    this.eventListenersMap.clear();
    this.invalidateCache();
    this.isInitialized = false;
  }

  private async syncItem(item: QueueItem): Promise<void> {
    return this.retryPolicy.executeWithRetry(
      async () => {
        const response = await this.sendToServer(item);

        if (response.success) {
          await this.updateOperationStatus(item.id, "synced");
        } else if (response.conflicts && response.conflicts.length > 0) {
          const conflict = response.conflicts[0];
          const resolvedItem = await this.conflictResolver.resolve(
            item,
            conflict.serverData
          );

          await this.storage.removeOperation(item.id);
          const { entityTable, entityId, operation, data } =
            this.queueItemToOutbox(resolvedItem, resolvedItem.id);
          await this.storage.addOperation(
            entityTable,
            entityId,
            operation,
            data
          );
        } else {
          throw new Error(response.error || "Unknown server error");
        }
      },
      (attempt, error) => {
        this.log(`Retry ${attempt} for item ${item.id}:`, error.message);
        this.updateOperationStatus(item.id, "error", error.message);
      }
    );
  }

  private async sendToServer(item: QueueItem): Promise<ServerResponse> {
    const endpoint = `${this.config.serverUrl}/sync`;

    const response = await this.acquireConnection(() =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify({
          id: item.id,
          type: item.type,
          payload: item.payload,
          timestamp: item.updatedAt,
        }),
        signal: this.abortController.signal,
      })
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  private setupRetryPolicy(): void {
    this.retryPolicy = new RetryPolicy({
      initialDelay: this.config.initialRetryDelay,
      multiplier: this.config.backoffMultiplier,
      maxDelay: this.config.initialRetryDelay * 10,
      maxRetries: this.config.maxRetries,
    });
  }

  private setupNetworkListener(): void {
    this.netMonitor.addEventListener((event) => {
      if (event.type === "connection_changed") {
        this.emitEvent("connection_changed", event.data);

        if (event.data?.isOnline && this.isActive && !this.isSyncing) {
          setTimeout(() => this.forceSync(), 1000);
        }
      }
    });
  }

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          nextAppState === "active" &&
          this.isActive &&
          this.netMonitor.getConnectionStatus() &&
          !this.isSyncing
        ) {
          setTimeout(() => this.forceSync(), 500);
        }
      }
    );
  }

  private setupSyncInterval(): void {
    if (this.config.syncInterval > 0) {
      this.syncInterval = setInterval(() => {
        if (
          this.isActive &&
          this.netMonitor.getConnectionStatus() &&
          !this.isSyncing
        ) {
          this.forceSync();
        }
      }, this.config.syncInterval);
    }
  }

  private async waitForSyncCompletion(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (this.isSyncing && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async executeHook(hookName: string, ...args: any[]): Promise<void> {
    const hook = (this.hooks as any)?.[hookName];
    if (hook) {
      try {
        await hook(...args);
      } catch (error) {
        this.log(`Error executing hook ${hookName}:`, error);
      }
    }
  }

  private emitEvent(type: SyncEvent["type"], data?: any, error?: Error): void {
    const event: SyncEvent = {
      type,
      timestamp: Date.now(),
      data,
      error,
    };

    const specificListeners = this.eventListenersMap.get(type);
    if (specificListeners && specificListeners.size > 0) {
      specificListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          this.log("Error notifying specific listener:", error);
        }
      });
    }

    if (this.listeners.length > 0) {
      this.listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          this.log("Error notifying global listener:", error);
        }
      });
    }
  }

  private bindMethods(): void {
    this.forceSync = this.forceSync.bind(this);
    this.addToQueue = this.addToQueue.bind(this);
  }

  private log(...args: any[]): void {
    if (this.debug) {
      console.log("[SyncEngine]", ...args);
    }
  }

  public setForcedOnline(isOnline: boolean | null) {
    this.netMonitor.setForcedOnline(isOnline);
  }
}
