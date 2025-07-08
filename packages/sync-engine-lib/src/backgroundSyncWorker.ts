import { SyncAdapter } from "./adapters/SyncAdapter";
import { NetMonitor } from "./netMonitor";
import { OutboxOperation, OutboxStatus, QueueStorage } from "./queueStorage";

export interface BackgroundSyncConfig {
  batchSize?: number;
  syncInterval?: number;
  maxConcurrentOperations?: number;
  retryDelay?: number;
  maxRetries?: number;
}

export interface SyncWorkerStats {
  processed: number;
  succeeded: number;
  failed: number;
  lastRun?: number;
  isRunning: boolean;
}

export type SyncWorkerEventType =
  | "sync_started"
  | "sync_completed"
  | "operation_synced"
  | "operation_failed"
  | "batch_completed"
  | "sync_error";

export interface SyncWorkerEvent {
  type: SyncWorkerEventType;
  timestamp: number;
  data?: any;
  error?: Error;
}

export type SyncWorkerEventListener = (event: SyncWorkerEvent) => void;

export class BackgroundSyncWorker {
  private queueStorage: QueueStorage;
  private adapter: SyncAdapter;
  private netMonitor: NetMonitor;
  private config: Required<BackgroundSyncConfig>;
  private isRunning = false;
  private syncInterval?: NodeJS.Timeout;
  private listeners: SyncWorkerEventListener[] = [];
  private stats: SyncWorkerStats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    isRunning: false,
  };

  constructor(
    queueStorage: QueueStorage,
    adapter: SyncAdapter,
    netMonitor: NetMonitor,
    config: BackgroundSyncConfig = {}
  ) {
    this.queueStorage = queueStorage;
    this.adapter = adapter;
    this.netMonitor = netMonitor;
    this.config = {
      batchSize: config.batchSize || 10,
      syncInterval: config.syncInterval || 30000,
      maxConcurrentOperations: config.maxConcurrentOperations || 3,
      retryDelay: config.retryDelay || 5000,
      maxRetries: config.maxRetries || 3,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.stats.isRunning = true;
    this.emitEvent("sync_started", {});

    if (this.netMonitor.getConnectionStatus()) {
      await this.processPendingOperations();
    }

    this.syncInterval = setInterval(async () => {
      if (this.netMonitor.getConnectionStatus()) {
        await this.processPendingOperations();
      }
    }, this.config.syncInterval);
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.stats.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  async forceSync(): Promise<SyncWorkerStats> {
    if (!this.netMonitor.getConnectionStatus()) {
      throw new Error("No network connection available");
    }

    await this.processPendingOperations();
    return this.getStats();
  }

  private async processPendingOperations(): Promise<void> {
    if (!this.netMonitor.getConnectionStatus()) return;

    try {
      const operations = await this.queueStorage.getPendingOperations(
        this.config.batchSize
      );

      if (operations.length === 0) return;

      this.emitEvent("sync_started", { operationCount: operations.length });

      await this.queueStorage.batchUpdateOperations(
        operations.map((op) => ({
          id: op.id,
          status: "syncing" as OutboxStatus,
        }))
      );

      const results = await this.processBatch(operations);

      this.stats.processed += operations.length;
      this.stats.succeeded += results.succeeded;
      this.stats.failed += results.failed;
      this.stats.lastRun = Date.now();

      this.emitEvent("batch_completed", {
        total: operations.length,
        succeeded: results.succeeded,
        failed: results.failed,
      });
    } catch (error) {
      this.emitEvent("sync_error", { error });
      throw error;
    }
  }

  private async processBatch(operations: OutboxOperation[]): Promise<{
    succeeded: number;
    failed: number;
  }> {
    let succeeded = 0;
    let failed = 0;

    const chunks = this.chunkArray(
      operations,
      this.config.maxConcurrentOperations
    );

    for (const chunk of chunks) {
      const promises = chunk.map((operation) =>
        this.processOperation(operation)
      );
      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          succeeded++;
        } else {
          failed++;
          console.error(`Operation ${chunk[index].id} failed:`, result.reason);
        }
      });
    }

    return { succeeded, failed };
  }

  private async processOperation(operation: OutboxOperation): Promise<void> {
    try {
      const data = JSON.parse(operation.data || "{}");

      let result;
      switch (operation.operation) {
        case "CREATE":
          result = await this.adapter.create(operation.entity_table, data);
          break;
        case "UPDATE":
          result = await this.adapter.update(
            operation.entity_table,
            operation.entity_id,
            data
          );
          break;
        case "DELETE":
          result = await this.adapter.delete(
            operation.entity_table,
            operation.entity_id
          );
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.operation}`);
      }

      await this.queueStorage.updateOperationStatus(operation.id, "synced");

      if (result?.data?.id && operation.operation === "CREATE") {
        await this.queueStorage.updateEntityStatus(
          operation.entity_table,
          operation.entity_id,
          "synced",
          result.data.id
        );
      }

      this.emitEvent("operation_synced", {
        operation,
        result,
      });
    } catch (error) {
      if (operation.retry_count < operation.max_retries) {
        await this.queueStorage.updateOperationStatus(
          operation.id,
          "failed",
          error instanceof Error ? error.message : String(error)
        );
      } else {
        await this.queueStorage.updateOperationStatus(
          operation.id,
          "failed",
          `Max retries (${operation.max_retries}) exceeded: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      this.emitEvent("operation_failed", {
        operation,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      throw error;
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  addEventListener(listener: SyncWorkerEventListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: SyncWorkerEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private emitEvent(type: SyncWorkerEventType, data: any): void {
    const event: SyncWorkerEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in sync worker event listener:", error);
      }
    });
  }

  getStats(): SyncWorkerStats {
    return { ...this.stats };
  }

  async getQueueStats() {
    return await this.queueStorage.getQueueStats();
  }

  async resetStats(): Promise<void> {
    this.stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      lastRun: undefined,
      isRunning: this.isRunning,
    };
  }
}
