import { AppState, AppStateStatus } from "react-native";
import { QueueStorage } from "./queueStorage";
import { NetMonitor } from "./netMonitor";
import { RetryPolicy, RetryPolicies } from "./retryPolicy";
import { ConflictResolver, ConflictStrategies } from "./conflictResolver";
import {
  QueueItem,
  SyncConfig,
  SyncStatus,
  SyncEngineOptions,
  SyncEventListener,
  SyncEvent,
  ServerResponse,
} from "./types";

export class SyncEngine {
  private storage: QueueStorage;
  private netMonitor: NetMonitor;
  private retryPolicy: RetryPolicy;
  private conflictResolver: ConflictResolver;
  private config: SyncConfig;
  private hooks: SyncEngineOptions["hooks"];
  private debug: boolean;

  private isInitialized: boolean = false;
  private isSyncing: boolean = false;
  private isActive: boolean = false;
  private lastSync?: number;
  private syncInterval?: NodeJS.Timeout;
  private listeners: SyncEventListener[] = [];
  private appStateSubscription?: { remove: () => void };

  constructor(options: SyncEngineOptions) {
    this.config = options.config;
    this.hooks = options.hooks;
    this.debug = options.debug || false;

    this.storage = new QueueStorage();
    this.netMonitor = new NetMonitor();
    this.retryPolicy = RetryPolicies.default();
    this.conflictResolver = new ConflictResolver(
      options.conflictStrategy || ConflictStrategies.timestampWins()
    );

    this.setupRetryPolicy();
    this.bindMethods();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.log("Inicializando Sync Engine...");

      await this.storage.initialize();
      await this.netMonitor.initialize();

      this.setupNetworkListener();
      this.setupAppStateListener();

      this.isInitialized = true;
      this.log("Sync Engine inicializada com sucesso");
    } catch (error) {
      this.log("Erro ao inicializar Sync Engine:", error);
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
    this.log("Iniciando sincronização automática");

    if (this.netMonitor.getConnectionStatus()) {
      await this.forceSync();
    }
    this.setupSyncInterval();

    this.emitEvent("sync_started", { autoSync: true });
  }

  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.log("Parando sincronização automática");

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
      await this.storage.addItem({
        id,
        type,
        payload,
        status,
      });

      this.log(`Item adicionado à queue: ${id} (${type})`);
      this.emitEvent("item_queued", { id, type, payload });

      await this.executeHook("onQueueChange", await this.getStatus());

      if (
        this.isActive &&
        this.netMonitor.getConnectionStatus() &&
        !this.isSyncing
      ) {
        setTimeout(() => this.forceSync(), 100);
      }
    } catch (error) {
      this.log("Erro ao adicionar item à queue:", error);
      throw error;
    }
  }

  async forceSync(): Promise<{
    success: boolean;
    syncedItems: number;
    errors: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isSyncing) {
      this.log("Sync já em execução, aguardando...");
      await this.waitForSyncCompletion();
      return { success: true, syncedItems: 0, errors: 0 };
    }

    if (!this.netMonitor.getConnectionStatus()) {
      this.log("Sem conexão, sync cancelado");
      return { success: false, syncedItems: 0, errors: 0 };
    }

    this.isSyncing = true;
    let syncedItems = 0;
    let errors = 0;

    try {
      this.log("Iniciando sincronização forçada");
      this.emitEvent("sync_started");

      const pendingItems = await this.storage.getPendingItems(
        this.config.batchSize
      );

      if (pendingItems.length === 0) {
        this.log("Nenhum item pendente para sincronizar");
        return { success: true, syncedItems: 0, errors: 0 };
      }

      this.log(`Sincronizando ${pendingItems.length} items`);

      await this.executeHook("onBeforeSync", pendingItems);

      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          syncedItems++;
          this.emitEvent("item_synced", { item });
        } catch (error) {
          errors++;
          this.log(`Erro ao sincronizar item ${item.id}:`, error);
          this.emitEvent("item_failed", { item, error });
        }
      }

      await this.executeHook("onSyncSuccess", pendingItems);

      this.lastSync = Date.now();
      this.log(`Sync completo: ${syncedItems} sincronizados, ${errors} erros`);

      this.emitEvent("sync_completed", { syncedItems, errors });

      return { success: errors === 0, syncedItems, errors };
    } catch (error) {
      this.log("Erro durante sincronização:", error);
      this.emitEvent("sync_failed", { error });
      await this.executeHook("onSyncError", error, []);
      throw error;
    } finally {
      this.isSyncing = false;
    }
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

    const stats = await this.storage.getQueueStats();

    return {
      isActive: this.isActive,
      lastSync: this.lastSync,
      pendingItems: stats.pending,
      errorItems: stats.error,
      isOnline: this.netMonitor.getConnectionStatus(),
      isSyncing: this.isSyncing,
    };
  }

  addEventListener(listener: SyncEventListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: SyncEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  async clearSyncedItems(): Promise<void> {
    await this.storage.removeSyncedItems();
    this.log("Items sincronizados removidos");
  }

  async retryFailedItems(): Promise<void> {
    const errorItems = await this.storage.getErrorItems();

    for (const item of errorItems) {
      await this.storage.updateItemStatus(item.id, "pending");
    }

    this.log(`${errorItems.length} items com erro foram marcados para retry`);

    if (this.isActive && this.netMonitor.getConnectionStatus()) {
      await this.forceSync();
    }
  }

  async destroy(): Promise<void> {
    this.log("Finalizando Sync Engine");

    this.stop();

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.netMonitor.destroy();
    await this.storage.close();

    this.listeners = [];
    this.isInitialized = false;
  }

  private async syncItem(item: QueueItem): Promise<void> {
    return this.retryPolicy.executeWithRetry(
      async () => {
        const response = await this.sendToServer(item);

        if (response.success) {
          await this.storage.updateItemStatus(item.id, "synced");
        } else if (response.conflicts && response.conflicts.length > 0) {
          const conflict = response.conflicts[0];
          const resolvedItem = await this.conflictResolver.resolve(
            item,
            conflict.serverData
          );

          await this.storage.removeItem(item.id);
          await this.storage.addItem({
            id: resolvedItem.id,
            type: resolvedItem.type,
            payload: resolvedItem.payload,
            status: "pending",
          });
        } else {
          throw new Error(response.error || "Erro desconhecido no servidor");
        }
      },
      (attempt, error) => {
        this.log(`Retry ${attempt} para item ${item.id}:`, error.message);
        this.storage.updateItemStatus(item.id, "error", true);
      }
    );
  }

  private async sendToServer(item: QueueItem): Promise<ServerResponse> {
    const endpoint = `${this.config.serverUrl}/sync`;

    const response = await fetch(endpoint, {
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
      signal: new AbortController().signal,
    });

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
        this.log(`Erro ao executar hook ${hookName}:`, error);
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

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.log("Erro ao notificar listener:", error);
      }
    });
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
}
