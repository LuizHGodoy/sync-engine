import { SyncEngine } from "./syncEngine";

interface BackgroundSyncOptions {
  taskName?: string;
  interval?: number;
  enableOnAppBackground?: boolean;
  enableOnNetworkReconnect?: boolean;
  batchSize?: number;
  maxBackgroundDuration?: number;
  fallbackToForeground?: boolean;
}

interface BackgroundTaskManager {
  name: string;
  isSupported: () => Promise<boolean>;
  register: (
    taskFn: () => Promise<void>,
    options: BackgroundSyncOptions
  ) => Promise<string>;
  unregister: (taskId: string) => Promise<void>;
  isTaskRegistered: (taskId: string) => Promise<boolean>;
}

class ExpoBackgroundTaskManager implements BackgroundTaskManager {
  name = "expo-background-task";
  private BackgroundTask: any;
  private TaskManager: any;

  async isSupported(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.BackgroundTask = require("expo-background-task").default;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.TaskManager = require("expo-task-manager").default;
      return true;
    } catch {
      return false;
    }
  }

  async register(
    taskFn: () => Promise<void>,
    options: BackgroundSyncOptions
  ): Promise<string> {
    const taskName = options.taskName || "SYNC_ENGINE_BACKGROUND_TASK";

    this.TaskManager.defineTask(taskName, async () => {
      try {
        await taskFn();
        return this.BackgroundTask.BackgroundTaskResult.NewData;
      } catch (error) {
        console.error("Background sync failed:", error);
        return this.BackgroundTask.BackgroundTaskResult.Failed;
      }
    });

    await this.BackgroundTask.registerTaskAsync(taskName, {
      minimumInterval: options.interval || 15000,
    });

    return taskName;
  }

  async unregister(taskId: string): Promise<void> {
    await this.BackgroundTask.unregisterTaskAsync(taskId);
  }

  async isTaskRegistered(taskId: string): Promise<boolean> {
    const isRegistered = await this.BackgroundTask.isRegisteredAsync(taskId);
    return isRegistered;
  }
}

class RNBackgroundJobManager implements BackgroundTaskManager {
  name = "react-native-background-job";
  private BackgroundJob: any;

  async isSupported(): Promise<boolean> {
    try {
      this.BackgroundJob = require("react-native-background-job").default; // eslint-disable-line @typescript-eslint/no-var-requires
      return true;
    } catch {
      return false;
    }
  }

  async register(
    taskFn: () => Promise<void>,
    options: BackgroundSyncOptions
  ): Promise<string> {
    const taskId = options.taskName || "sync_engine_bg_task";

    this.BackgroundJob.start({
      jobKey: taskId,
      period: options.interval || 30000,
      executor: async () => {
        try {
          await taskFn();
        } catch (error) {
          console.error("Background sync failed:", error);
        }
      },
    });

    return taskId;
  }

  async unregister(taskId: string): Promise<void> {
    this.BackgroundJob.stop({ jobKey: taskId });
  }

  async isTaskRegistered(taskId: string): Promise<boolean> {
    return this.BackgroundJob.isRunning({ jobKey: taskId });
  }
}

class TimerBackgroundManager implements BackgroundTaskManager {
  name = "timer-fallback";
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  async isSupported(): Promise<boolean> {
    return true;
  }

  async register(
    taskFn: () => Promise<void>,
    options: BackgroundSyncOptions
  ): Promise<string> {
    const taskId = options.taskName || `timer_${Date.now()}`;

    const interval = setInterval(async () => {
      try {
        await taskFn();
      } catch (error) {
        console.error("Timer-based sync failed:", error);
      }
    }, options.interval || 60000);

    this.intervals.set(taskId, interval);
    return taskId;
  }

  async unregister(taskId: string): Promise<void> {
    const interval = this.intervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }
  }

  async isTaskRegistered(taskId: string): Promise<boolean> {
    return this.intervals.has(taskId);
  }
}

export class BackgroundSyncManager {
  private syncEngine: SyncEngine;
  private taskManager: BackgroundTaskManager | null = null;
  private currentTaskId: string | null = null;
  private options: BackgroundSyncOptions;
  private isEnabled = false;

  private taskManagers: BackgroundTaskManager[] = [
    new ExpoBackgroundTaskManager(),
    new RNBackgroundJobManager(),
    new TimerBackgroundManager(),
  ];

  constructor(syncEngine: SyncEngine, options: BackgroundSyncOptions = {}) {
    this.syncEngine = syncEngine;
    this.options = {
      taskName: "SYNC_ENGINE_BG",
      interval: 30000,
      enableOnAppBackground: true,
      enableOnNetworkReconnect: true,
      batchSize: 25,
      maxBackgroundDuration: 25000,
      fallbackToForeground: true,
      ...options,
    };
  }

  async initialize(): Promise<boolean> {
    for (const manager of this.taskManagers) {
      try {
        if (await manager.isSupported()) {
          this.taskManager = manager;
          console.log(`[BackgroundSync] Using ${manager.name}`);
          break;
        }
      } catch (error) {
        console.warn(`[BackgroundSync] ${manager.name} not available:`, error);
      }
    }

    if (!this.taskManager) {
      console.error("[BackgroundSync] No task manager available");
      return false;
    }

    await this.setupAppStateListeners();
    return true;
  }

  async enable(): Promise<boolean> {
    if (this.isEnabled || !this.taskManager) {
      return false;
    }

    try {
      this.currentTaskId = await this.taskManager.register(
        () => this.performBackgroundSync(),
        this.options
      );

      this.isEnabled = true;
      console.log(`[BackgroundSync] Enabled with task: ${this.currentTaskId}`);
      return true;
    } catch (error) {
      console.error("[BackgroundSync] Failed to enable:", error);
      return false;
    }
  }

  async disable(): Promise<void> {
    if (!this.isEnabled || !this.taskManager || !this.currentTaskId) {
      return;
    }

    try {
      await this.taskManager.unregister(this.currentTaskId);
      this.isEnabled = false;
      this.currentTaskId = null;
      console.log("[BackgroundSync] Disabled");
    } catch (error) {
      console.error("[BackgroundSync] Failed to disable:", error);
    }
  }

  private async performBackgroundSync(): Promise<void> {
    const startTime = Date.now();
    const maxDuration = this.options.maxBackgroundDuration || 25000;

    try {
      console.log("[BackgroundSync] Starting background sync...");

      const status = await this.syncEngine.getStatus();
      if (status.pendingItems === 0) {
        console.log("[BackgroundSync] No pending items, skipping");
        return;
      }

      const syncPromise = this.syncEngine.forceSync();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Background sync timeout")),
          maxDuration - 2000
        );
      });

      const result = await Promise.race([syncPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      console.log(
        `[BackgroundSync] Completed: ${result.syncedItems} items in ${duration}ms`
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[BackgroundSync] Failed after ${duration}ms:`, error);

      if (this.options.fallbackToForeground) {
        setTimeout(async () => {
          const status = await this.syncEngine.getStatus();
          if (status.isActive) {
            this.syncEngine.forceSync().catch(console.error);
          }
        }, 1000);
      }
    }
  }

  private async setupAppStateListeners(): Promise<void> {
    if (
      !this.options.enableOnAppBackground &&
      !this.options.enableOnNetworkReconnect
    ) {
      return;
    }

    try {
      const { AppState } = await import("react-native");

      if (this.options.enableOnAppBackground) {
        AppState.addEventListener("change", (nextAppState) => {
          if (nextAppState === "background" && this.isEnabled) {
            setTimeout(() => this.performBackgroundSync(), 1000);
          }
        });
      }
    } catch (error) {
      console.warn("[BackgroundSync] AppState not available:", error);
    }

    if (this.options.enableOnNetworkReconnect) {
      this.syncEngine.addEventListener((event) => {
        if (
          event.type === "connection_changed" &&
          event.data?.isOnline &&
          this.isEnabled
        ) {
          setTimeout(() => this.performBackgroundSync(), 2000);
        }
      });
    }
  }

  isBackgroundSyncEnabled(): boolean {
    return this.isEnabled;
  }

  getTaskManagerName(): string | null {
    return this.taskManager?.name || null;
  }

  async getBackgroundSyncStatus(): Promise<{
    enabled: boolean;
    taskManager: string | null;
    taskId: string | null;
    lastSync?: number;
  }> {
    return {
      enabled: this.isEnabled,
      taskManager: this.taskManager?.name || null,
      taskId: this.currentTaskId,
    };
  }
}

export function createBackgroundSync(
  syncEngine: SyncEngine,
  options?: BackgroundSyncOptions
): BackgroundSyncManager {
  return new BackgroundSyncManager(syncEngine, options);
}

export interface SyncEngineWithBackground extends SyncEngine {
  backgroundSync?: BackgroundSyncManager;
  enableBackgroundSync: (options?: BackgroundSyncOptions) => Promise<boolean>;
  disableBackgroundSync: () => Promise<void>;
  isBackgroundSyncEnabled: () => boolean;
}

export function addBackgroundSyncToEngine(
  syncEngine: SyncEngine,
  options?: BackgroundSyncOptions
): SyncEngineWithBackground {
  const engine = syncEngine as SyncEngineWithBackground;

  engine.backgroundSync = new BackgroundSyncManager(syncEngine, options);

  engine.enableBackgroundSync = async (opts?: BackgroundSyncOptions) => {
    if (opts) {
      engine.backgroundSync = new BackgroundSyncManager(syncEngine, opts);
    }
    await engine.backgroundSync!.initialize();
    return engine.backgroundSync!.enable();
  };

  engine.disableBackgroundSync = async () => {
    if (engine.backgroundSync) {
      await engine.backgroundSync.disable();
    }
  };

  engine.isBackgroundSyncEnabled = () => {
    return engine.backgroundSync?.isBackgroundSyncEnabled() || false;
  };

  return engine;
}
