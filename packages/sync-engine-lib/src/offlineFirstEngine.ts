import { RestAdapter } from "./adapters/RestAdapter";
import { SyncAdapter } from "./adapters/SyncAdapter";
import {
  BackgroundSyncConfig,
  BackgroundSyncWorker,
} from "./backgroundSyncWorker";
import { NetMonitor } from "./netMonitor";
import { OfflineFirstDB, createEntityDB } from "./offlineFirstDB";
import { QueueStorage, QueueStorageConfig } from "./queueStorage";

export interface OfflineFirstEngineConfig {
  adapter:
    | SyncAdapter
    | {
        type: "rest";
        baseURL: string;
        headers?: Record<string, string>;
        timeout?: number;
      };
  entities: Record<string, any>;
  storage?: QueueStorageConfig;
  sync?: BackgroundSyncConfig;
}

export class OfflineFirstEngine {
  private queueStorage: QueueStorage;
  private offlineDB: OfflineFirstDB;
  private syncWorker: BackgroundSyncWorker;
  private netMonitor: NetMonitor;
  private adapter: SyncAdapter;
  private initialized = false;
  private config: OfflineFirstEngineConfig;

  constructor(config: OfflineFirstEngineConfig) {
    this.config = config;

    this.queueStorage = new QueueStorage(config.storage);
    this.netMonitor = new NetMonitor();

    if ("type" in config.adapter) {
      switch (config.adapter.type) {
        case "rest":
          this.adapter = new RestAdapter({
            baseURL: config.adapter.baseURL,
            headers: config.adapter.headers,
            timeout: config.adapter.timeout,
          });
          break;
        default:
          throw new Error(
            `Unknown adapter type: ${(config.adapter as any).type}`
          );
      }
    } else {
      this.adapter = config.adapter;
    }

    this.offlineDB = new OfflineFirstDB({
      syncAdapter: this.adapter,
      entities: config.entities,
    });

    this.syncWorker = new BackgroundSyncWorker(
      this.queueStorage,
      this.adapter,
      this.netMonitor,
      config.sync
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.queueStorage.initialize();
    await this.offlineDB.initialize();
    await this.netMonitor.initialize();

    this.initialized = true;
  }

  async start(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.syncWorker.start();
  }

  stop(): void {
    this.syncWorker.stop();
  }

  table<T extends Record<string, any> = any>(tableName: string) {
    return createEntityDB<T>(this.offlineDB, tableName);
  }

  get storage() {
    return this.queueStorage;
  }

  get database() {
    return this.offlineDB;
  }

  get worker() {
    return this.syncWorker;
  }

  get network() {
    return this.netMonitor;
  }

  async forceSync(): Promise<void> {
    await this.syncWorker.forceSync();
  }

  async getStats() {
    const [queueStats, workerStats] = await Promise.all([
      this.queueStorage.getQueueStats(),
      this.syncWorker.getStats(),
    ]);

    return {
      queue: queueStats,
      worker: workerStats,
      isOnline: this.netMonitor.getConnectionStatus(),
    };
  }

  async close(): Promise<void> {
    this.stop();
    await this.queueStorage.close();
  }
}
