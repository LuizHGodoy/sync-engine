export { SyncEngine } from "./syncEngine";

export * from "./adapters";
export { BackgroundSyncWorker } from "./backgroundSyncWorker";
export { createEntityDB, OfflineFirstDB } from "./offlineFirstDB";
export { OfflineFirstEngine } from "./offlineFirstEngine";

export {
  ConflictResolver,
  ConflictStrategies,
  ConflictUtils,
} from "./conflictResolver";
export {
  DEFAULT_SYNC_CONFIG,
  getOptimizedConfig,
  PERFORMANCE_PRESETS,
} from "./defaults";
export { NetMonitor } from "./netMonitor";
export { QueueStorage } from "./queueStorage";
export { RetryPolicies, RetryPolicy } from "./retryPolicy";

export {
  addBackgroundSyncToEngine,
  BackgroundSyncManager,
  createBackgroundSync,
  type SyncEngineWithBackground,
} from "./backgroundSync";

export type {
  BackoffConfig,
  BatchSyncResult,
  ConflictResolutionStrategy,
  QueueItem,
  ServerResponse,
  SyncConfig,
  SyncEngineOptions,
  SyncEvent,
  SyncEventListener,
  SyncEventType,
  SyncHooks,
  SyncStatus,
} from "./types";

export type {
  EntityMetadata,
  EntityStatus,
  OutboxOperation,
  OutboxStatus,
  QueueStorageConfig,
} from "./queueStorage";

export type {
  EntityConfig,
  EntitySchema,
  EntityWithMetadata,
  OfflineFirstDBConfig,
} from "./offlineFirstDB";

export type {
  BackgroundSyncConfig,
  SyncWorkerEvent,
  SyncWorkerEventListener,
  SyncWorkerEventType,
  SyncWorkerStats,
} from "./backgroundSyncWorker";

export type { OfflineFirstEngineConfig } from "./offlineFirstEngine";

import { ConflictStrategies } from "./conflictResolver";
import { getOptimizedConfig } from "./defaults";
import { SyncEngine } from "./syncEngine";
import { SyncConfig, SyncEngineOptions } from "./types";

export const SyncEngineUtils = {
  createDefaultConfig: (serverUrl: string): SyncConfig => ({
    serverUrl,
    batchSize: 25,
    syncInterval: 30000,
    maxRetries: 3,
    initialRetryDelay: 1000,
    backoffMultiplier: 1.8,
    requestTimeout: 15000,
    maxConcurrentRequests: 4,
    enableBatchSync: true,
    cacheExpiration: 30000,
  }),

  createOptimizedConfig: (
    serverUrl: string,
    preset: "conservative" | "balanced" | "aggressive" | "realtime" = "balanced"
  ): SyncConfig =>
    ({
      ...getOptimizedConfig(preset),
      serverUrl,
    } as SyncConfig),

  generateId: (): string => {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  validateConfig: (
    config: SyncConfig
  ): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!config.serverUrl || !config.serverUrl.trim()) {
      errors.push("serverUrl é obrigatório");
    }

    if (config.batchSize <= 0) {
      errors.push("batchSize deve ser maior que 0");
    }

    if (config.maxRetries < 0) {
      errors.push("maxRetries deve ser maior ou igual a 0");
    }

    if (config.initialRetryDelay < 0) {
      errors.push("initialRetryDelay deve ser maior ou igual a 0");
    }

    if (config.backoffMultiplier <= 1) {
      errors.push("backoffMultiplier deve ser maior que 1");
    }

    if (config.requestTimeout <= 0) {
      errors.push("requestTimeout deve ser maior que 0");
    }

    try {
      new URL(config.serverUrl);
    } catch {
      errors.push("serverUrl deve ser uma URL válida");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  createDefaultOptions: (config: SyncConfig): SyncEngineOptions => ({
    config,
    conflictStrategy: ConflictStrategies.timestampWins(),
    debug: false,
  }),
};

export const SyncEngineConstants = {
  SYNC_INTERVALS: {
    VERY_FAST: 5000,
    FAST: 15000,
    NORMAL: 30000,
    SLOW: 60000,
    VERY_SLOW: 300000,
  },

  BATCH_SIZES: {
    SMALL: 5,
    MEDIUM: 10,
    LARGE: 25,
    VERY_LARGE: 50,
  },

  TIMEOUTS: {
    FAST: 5000,
    NORMAL: 10000,
    SLOW: 30000,
  },

  RETRY_DELAYS: {
    FAST: 500,
    NORMAL: 1000,
    SLOW: 2000,
  },
};

export const SyncEngineFactory = {
  createForDevelopment: (
    serverUrl: string,
    options?: Partial<SyncEngineOptions>
  ) => {
    const config = SyncEngineUtils.createDefaultConfig(serverUrl);

    return new SyncEngine({
      config: {
        ...config,
        syncInterval: SyncEngineConstants.SYNC_INTERVALS.FAST,
        ...options?.config,
      },
      conflictStrategy: ConflictStrategies.timestampWins(),
      debug: true,
      ...options,
    });
  },

  createForProduction: (
    serverUrl: string,
    options?: Partial<SyncEngineOptions>
  ) => {
    const config = SyncEngineUtils.createDefaultConfig(serverUrl);

    return new SyncEngine({
      config: {
        ...config,
        syncInterval: SyncEngineConstants.SYNC_INTERVALS.NORMAL,
        batchSize: SyncEngineConstants.BATCH_SIZES.LARGE,
        ...options?.config,
      },
      conflictStrategy: ConflictStrategies.timestampWins(),
      debug: false,
      ...options,
    });
  },

  createConservative: (
    serverUrl: string,
    options?: Partial<SyncEngineOptions>
  ) => {
    const config = SyncEngineUtils.createDefaultConfig(serverUrl);

    return new SyncEngine({
      config: {
        ...config,
        syncInterval: SyncEngineConstants.SYNC_INTERVALS.SLOW,
        batchSize: SyncEngineConstants.BATCH_SIZES.SMALL,
        maxRetries: 5,
        initialRetryDelay: SyncEngineConstants.RETRY_DELAYS.SLOW,
        requestTimeout: SyncEngineConstants.TIMEOUTS.SLOW,
        ...options?.config,
      },
      conflictStrategy: ConflictStrategies.manual(),
      debug: false,
      ...options,
    });
  },

  createAggressive: (
    serverUrl: string,
    options?: Partial<SyncEngineOptions>
  ) => {
    const config = SyncEngineUtils.createDefaultConfig(serverUrl);

    return new SyncEngine({
      config: {
        ...config,
        syncInterval: SyncEngineConstants.SYNC_INTERVALS.VERY_FAST,
        batchSize: SyncEngineConstants.BATCH_SIZES.VERY_LARGE,
        maxRetries: 2,
        initialRetryDelay: SyncEngineConstants.RETRY_DELAYS.FAST,
        requestTimeout: SyncEngineConstants.TIMEOUTS.FAST,
        ...options?.config,
      },
      conflictStrategy: ConflictStrategies.clientWins(),
      debug: false,
      ...options,
    });
  },
};
