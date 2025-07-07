import { SyncConfig } from "./types";

export const DEFAULT_SYNC_CONFIG: Partial<SyncConfig> = {
  batchSize: 25,
  syncInterval: 30000,
  maxRetries: 3,
  initialRetryDelay: 1000,
  backoffMultiplier: 1.8,
  requestTimeout: 15000,
  maxConcurrentRequests: 4,
  enableBatchSync: true,
  cacheExpiration: 30000,
};

export const PERFORMANCE_PRESETS = {
  conservative: {
    ...DEFAULT_SYNC_CONFIG,
    batchSize: 10,
    maxConcurrentRequests: 2,
    enableBatchSync: false,
    cacheExpiration: 60000,
  },

  balanced: {
    ...DEFAULT_SYNC_CONFIG,
  },

  aggressive: {
    ...DEFAULT_SYNC_CONFIG,
    batchSize: 50,
    maxConcurrentRequests: 6,
    syncInterval: 15000,
    cacheExpiration: 15000,
  },

  realtime: {
    ...DEFAULT_SYNC_CONFIG,
    batchSize: 100,
    maxConcurrentRequests: 8,
    syncInterval: 5000,
    enableBatchSync: true,
    cacheExpiration: 5000,
  },
} as const;

export function getOptimizedConfig(
  preset: keyof typeof PERFORMANCE_PRESETS = "balanced"
): Partial<SyncConfig> {
  return PERFORMANCE_PRESETS[preset];
}
