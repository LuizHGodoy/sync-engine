import { QueueItem } from './types';
/**
 * Gerenciador de armazenamento da queue usando SQLite
 */
export declare class QueueStorage {
    private db;
    private readonly dbName;
    constructor(dbName?: string);
    /**
     * Inicializa o banco de dados e cria as tabelas necessárias
     */
    initialize(): Promise<void>;
    /**
     * Cria as tabelas necessárias
     */
    private createTables;
    /**
     * Adiciona um item à queue
     */
    addItem(item: Omit<QueueItem, 'retries' | 'createdAt' | 'updatedAt'>): Promise<void>;
    /**
     * Obtém items da queue por status
     */
    getItemsByStatus(status: QueueItem['status'], limit?: number): Promise<QueueItem[]>;
    /**
     * Obtém items pendentes para sincronização
     */
    getPendingItems(limit?: number): Promise<QueueItem[]>;
    /**
     * Obtém items com erro
     */
    getErrorItems(limit?: number): Promise<QueueItem[]>;
    /**
     * Atualiza o status de um item
     */
    updateItemStatus(id: string, status: QueueItem['status'], incrementRetries?: boolean): Promise<void>;
    /**
     * Remove um item da queue
     */
    removeItem(id: string): Promise<void>;
    /**
     * Remove todos os items sincronizados
     */
    removeSyncedItems(): Promise<void>;
    /**
     * Obtém estatísticas da queue
     */
    getQueueStats(): Promise<{
        pending: number;
        synced: number;
        error: number;
        total: number;
    }>;
    /**
     * Obtém um item específico por ID
     */
    getItem(id: string): Promise<QueueItem | null>;
    /**
     * Limpa toda a queue (uso cuidadoso)
     */
    clearQueue(): Promise<void>;
    /**
     * Executa uma transação
     */
    transaction(callback: () => Promise<void>): Promise<void>;
    /**
     * Mapeia uma linha do banco para QueueItem
     */
    private mapRowToQueueItem;
    /**
     * Fecha a conexão com o banco
     */
    close(): Promise<void>;
}
//# sourceMappingURL=queueStorage.d.ts.map