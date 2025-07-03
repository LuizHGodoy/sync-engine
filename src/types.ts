export interface QueueItem {
  id: string;
  type: string;
  payload: any;
  status: "pending" | "synced" | "error";
  retries: number;
  lastTriedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SyncConfig {
  serverUrl: string;
  batchSize: number;
  syncInterval: number;
  maxRetries: number;
  initialRetryDelay: number;
  backoffMultiplier: number;
  headers?: Record<string, string>;
  requestTimeout: number;
}

export interface SyncStatus {
  isActive: boolean;
  lastSync?: number;
  pendingItems: number;
  errorItems: number;
  isOnline: boolean;
  isSyncing: boolean;
}

export interface ConflictResolutionStrategy {
  name: string;
  resolve: (localItem: QueueItem, serverItem: any) => Promise<QueueItem>;
}

export interface SyncHooks {
  onBeforeSync?: (items: QueueItem[]) => Promise<void>;
  onSyncSuccess?: (items: QueueItem[]) => Promise<void>;
  onSyncError?: (error: Error, items: QueueItem[]) => Promise<void>;
  onQueueChange: (status: SyncStatus) => Promise<void>;
  onConnectionChange: (isOnline: boolean) => Promise<void>;
}

export interface SyncEngineOptions {
  config: SyncConfig;
  conflictStrategy?: ConflictResolutionStrategy;
  hooks?: SyncHooks;
  debug?: boolean;
}

export interface ServerResponse {
  success: boolean;
  data?: any;
  error?: string;
  conflicts?: Array<{
    id: string;
    serverData: any;
    conflictType: "version" | "concurrent" | "deleted";
  }>;
}

export interface BackoffConfig {
  initialDelay: number;
  multiplier: number;
  maxDelay: number;
  maxRetries: number;
}

export type SyncEventType =
  | "sync_started"
  | "sync_completed"
  | "sync_failed"
  | "item_queued"
  | "item_synced"
  | "item_failed"
  | "connection_changed"
  | "queue_changed";

export interface SyncEvent {
  type: SyncEventType;
  timestamp: number;
  data?: any;
  error?: Error;
}

export type SyncEventListener = (event: SyncEvent) => void;
