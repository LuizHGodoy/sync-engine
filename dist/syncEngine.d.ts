import { QueueItem, SyncStatus, SyncEngineOptions, SyncEventListener } from './types';
/**
 * Engine principal de sincronização bidirecional
 */
export declare class SyncEngine {
    private storage;
    private netMonitor;
    private retryPolicy;
    private conflictResolver;
    private config;
    private hooks;
    private debug;
    private isInitialized;
    private isSyncing;
    private isActive;
    private lastSync?;
    private syncInterval?;
    private listeners;
    private appStateSubscription?;
    constructor(options: SyncEngineOptions);
    /**
     * Inicializa a engine de sincronização
     */
    initialize(): Promise<void>;
    /**
     * Inicia a sincronização automática
     */
    start(): Promise<void>;
    /**
     * Para a sincronização automática
     */
    stop(): void;
    /**
     * Adiciona um item à queue de sincronização
     */
    addToQueue(id: string, type: string, payload: any, status?: QueueItem['status']): Promise<void>;
    /**
     * Força uma sincronização imediata
     */
    forceSync(): Promise<{
        success: boolean;
        syncedItems: number;
        errors: number;
    }>;
    /**
     * Obtém o status atual da sincronização
     */
    getStatus(): Promise<SyncStatus>;
    /**
     * Adiciona um listener de eventos
     */
    addEventListener(listener: SyncEventListener): void;
    /**
     * Remove um listener de eventos
     */
    removeEventListener(listener: SyncEventListener): void;
    /**
     * Limpa items sincronizados antigos
     */
    clearSyncedItems(): Promise<void>;
    /**
     * Reinicia items com erro
     */
    retryFailedItems(): Promise<void>;
    /**
     * Finaliza a engine
     */
    destroy(): Promise<void>;
    private syncItem;
    private sendToServer;
    private setupRetryPolicy;
    private setupNetworkListener;
    private setupAppStateListener;
    private setupSyncInterval;
    private waitForSyncCompletion;
    private executeHook;
    private emitEvent;
    private bindMethods;
    private log;
}
//# sourceMappingURL=syncEngine.d.ts.map