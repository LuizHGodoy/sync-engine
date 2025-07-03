import { SyncEventListener } from './types';
/**
 * Monitor de conectividade de rede
 */
export declare class NetMonitor {
    private isOnline;
    private listeners;
    private unsubscribe;
    /**
     * Inicializa o monitor de rede
     */
    initialize(): Promise<void>;
    /**
     * Retorna o status atual da conexão
     */
    getConnectionStatus(): boolean;
    /**
     * Adiciona um listener para mudanças de conectividade
     */
    addEventListener(listener: SyncEventListener): void;
    /**
     * Remove um listener
     */
    removeEventListener(listener: SyncEventListener): void;
    /**
     * Notifica todos os listeners sobre mudança de conectividade
     */
    private notifyListeners;
    /**
     * Verifica se está conectado à internet
     */
    checkConnection(): Promise<boolean>;
    /**
     * Aguarda até que a conexão seja estabelecida
     */
    waitForConnection(timeout?: number): Promise<boolean>;
    /**
     * Obtém informações detalhadas da conexão
     */
    getConnectionDetails(): Promise<{
        isConnected: boolean;
        type: string;
        isInternetReachable: boolean | null;
    }>;
    /**
     * Finaliza o monitor de rede
     */
    destroy(): void;
}
//# sourceMappingURL=netMonitor.d.ts.map