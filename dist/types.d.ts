/**
 * Tipos fundamentais da biblioteca Sync Engine
 */
export interface QueueItem {
    id: string;
    type: string;
    payload: any;
    status: 'pending' | 'synced' | 'error';
    retries: number;
    lastTriedAt?: number;
    createdAt: number;
    updatedAt: number;
}
export interface SyncConfig {
    /** URL base do servidor */
    serverUrl: string;
    /** Tamanho máximo do batch para sync */
    batchSize: number;
    /** Intervalo em ms para auto-sync */
    syncInterval: number;
    /** Número máximo de tentativas */
    maxRetries: number;
    /** Delay inicial para backoff em ms */
    initialRetryDelay: number;
    /** Multiplicador para backoff exponencial */
    backoffMultiplier: number;
    /** Headers customizados para requisições */
    headers?: Record<string, string>;
    /** Timeout das requisições em ms */
    requestTimeout: number;
}
export interface SyncStatus {
    /** Se o sync está ativo */
    isActive: boolean;
    /** Último sync realizado */
    lastSync?: number;
    /** Items pendentes na queue */
    pendingItems: number;
    /** Items com erro */
    errorItems: number;
    /** Se está conectado à internet */
    isOnline: boolean;
    /** Se está sincronizando no momento */
    isSyncing: boolean;
}
export interface ConflictResolutionStrategy {
    /** Nome da estratégia */
    name: string;
    /** Função para resolver conflitos */
    resolve: (localItem: QueueItem, serverItem: any) => Promise<QueueItem>;
}
export interface SyncHooks {
    /** Executado antes de iniciar o sync */
    onBeforeSync?: (items: QueueItem[]) => Promise<void>;
    /** Executado após sync bem-sucedido */
    onSyncSuccess?: (items: QueueItem[]) => Promise<void>;
    /** Executado quando ocorre erro no sync */
    onSyncError?: (error: Error, items: QueueItem[]) => Promise<void>;
    /** Executado quando a queue muda */
    onQueueChange?: (status: SyncStatus) => Promise<void>;
    /** Executado quando o status de conexão muda */
    onConnectionChange?: (isOnline: boolean) => Promise<void>;
}
export interface SyncEngineOptions {
    /** Configurações de sincronização */
    config: SyncConfig;
    /** Estratégia de resolução de conflitos */
    conflictStrategy?: ConflictResolutionStrategy;
    /** Hooks personalizados */
    hooks?: SyncHooks;
    /** Habilitar logs de debug */
    debug?: boolean;
}
export interface ServerResponse {
    success: boolean;
    data?: any;
    error?: string;
    conflicts?: Array<{
        id: string;
        serverData: any;
        conflictType: 'version' | 'concurrent' | 'deleted';
    }>;
}
export interface BackoffConfig {
    /** Delay inicial em ms */
    initialDelay: number;
    /** Multiplicador para cada tentativa */
    multiplier: number;
    /** Delay máximo em ms */
    maxDelay: number;
    /** Número máximo de tentativas */
    maxRetries: number;
}
export type SyncEventType = 'sync_started' | 'sync_completed' | 'sync_failed' | 'item_queued' | 'item_synced' | 'item_failed' | 'connection_changed' | 'queue_changed';
export interface SyncEvent {
    type: SyncEventType;
    timestamp: number;
    data?: any;
    error?: Error;
}
export type SyncEventListener = (event: SyncEvent) => void;
//# sourceMappingURL=types.d.ts.map