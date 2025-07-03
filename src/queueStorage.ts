import * as SQLite from 'expo-sqlite';
import { QueueItem } from './types';

/**
 * Gerenciador de armazenamento da queue usando SQLite
 */
export class QueueStorage {
  private db: SQLite.SQLiteDatabase | null = null;
  private readonly dbName: string;

  constructor(dbName: string = 'sync_engine.db') {
    this.dbName = dbName;
  }

  /**
   * Inicializa o banco de dados e cria as tabelas necessárias
   */
  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(this.dbName);
      await this.createTables();
    } catch (error) {
      throw new Error(`Erro ao inicializar banco de dados: ${error}`);
    }
  }

  /**
   * Cria as tabelas necessárias
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Banco de dados não inicializado');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retries INTEGER NOT NULL DEFAULT 0,
        lastTriedAt INTEGER,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `;

    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_type ON sync_queue(type);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(createdAt);
    `;

    await this.db.execAsync(createTableSQL);
    await this.db.execAsync(createIndexSQL);
  }

  /**
   * Adiciona um item à queue
   */
  async addItem(item: Omit<QueueItem, 'retries' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (!this.db) throw new Error('Banco de dados não inicializado');

    const now = Date.now();
    const queueItem: QueueItem = {
      ...item,
      retries: 0,
      createdAt: now,
      updatedAt: now,
    };

    const insertSQL = `
      INSERT INTO sync_queue (id, type, payload, status, retries, lastTriedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.runAsync(insertSQL, [
      queueItem.id,
      queueItem.type,
      JSON.stringify(queueItem.payload),
      queueItem.status,
      queueItem.retries,
      queueItem.lastTriedAt || null,
      queueItem.createdAt,
      queueItem.updatedAt,
    ]);
  }

  /**
   * Obtém items da queue por status
   */
  async getItemsByStatus(status: QueueItem['status'], limit?: number): Promise<QueueItem[]> {
    if (!this.db) throw new Error('Banco de dados não inicializado');

    let query = `
      SELECT * FROM sync_queue 
      WHERE status = ? 
      ORDER BY createdAt ASC
    `;

    const params: any[] = [status];

    if (limit && limit > 0) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const result = await this.db.getAllAsync(query, params);
    return result.map(this.mapRowToQueueItem);
  }

  /**
   * Obtém items pendentes para sincronização
   */
  async getPendingItems(limit?: number): Promise<QueueItem[]> {
    return this.getItemsByStatus('pending', limit);
  }

  /**
   * Obtém items com erro
   */
  async getErrorItems(limit?: number): Promise<QueueItem[]> {
    return this.getItemsByStatus('error', limit);
  }

  /**
   * Atualiza o status de um item
   */
  async updateItemStatus(
    id: string, 
    status: QueueItem['status'], 
    incrementRetries: boolean = false
  ): Promise<void> {
    if (!this.db) throw new Error('Banco de dados não inicializado');

    const now = Date.now();
    let updateSQL = `
      UPDATE sync_queue 
      SET status = ?, updatedAt = ?, lastTriedAt = ?
    `;
    const params: any[] = [status, now, now];

    if (incrementRetries) {
      updateSQL += ', retries = retries + 1';
    }

    updateSQL += ' WHERE id = ?';
    params.push(id);

    await this.db.runAsync(updateSQL, params);
  }

  /**
   * Remove um item da queue
   */
  async removeItem(id: string): Promise<void> {
    if (!this.db) throw new Error('Banco de dados não inicializado');

    const deleteSQL = 'DELETE FROM sync_queue WHERE id = ?';
    await this.db.runAsync(deleteSQL, [id]);
  }

  /**
   * Remove todos os items sincronizados
   */
  async removeSyncedItems(): Promise<void> {
    if (!this.db) throw new Error('Banco de dados não inicializado');

    const deleteSQL = 'DELETE FROM sync_queue WHERE status = ?';
    await this.db.runAsync(deleteSQL, ['synced']);
  }

  /**
   * Obtém estatísticas da queue
   */
  async getQueueStats(): Promise<{
    pending: number;
    synced: number;
    error: number;
    total: number;
  }> {
    if (!this.db) throw new Error('Banco de dados não inicializado');

    const statsSQL = `
      SELECT 
        status,
        COUNT(*) as count
      FROM sync_queue 
      GROUP BY status
    `;

    const result = await this.db.getAllAsync(statsSQL);
    
    const stats = {
      pending: 0,
      synced: 0,
      error: 0,
      total: 0,
    };

    for (const row of result) {
      const status = (row as any).status;
      const count = (row as any).count;
      stats[status as keyof typeof stats] = count;
      stats.total += count;
    }

    return stats;
  }

  /**
   * Obtém um item específico por ID
   */
  async getItem(id: string): Promise<QueueItem | null> {
    if (!this.db) throw new Error('Banco de dados não inicializado');

    const selectSQL = 'SELECT * FROM sync_queue WHERE id = ?';
    const result = await this.db.getFirstAsync(selectSQL, [id]);

    if (!result) return null;

    return this.mapRowToQueueItem(result);
  }

  /**
   * Limpa toda a queue (uso cuidadoso)
   */
  async clearQueue(): Promise<void> {
    if (!this.db) throw new Error('Banco de dados não inicializado');

    const deleteSQL = 'DELETE FROM sync_queue';
    await this.db.runAsync(deleteSQL);
  }

  /**
   * Executa uma transação
   */
  async transaction(callback: () => Promise<void>): Promise<void> {
    if (!this.db) throw new Error('Banco de dados não inicializado');

    await this.db.withTransactionAsync(callback);
  }

  /**
   * Mapeia uma linha do banco para QueueItem
   */
  private mapRowToQueueItem(row: any): QueueItem {
    return {
      id: row.id,
      type: row.type,
      payload: JSON.parse(row.payload),
      status: row.status,
      retries: row.retries,
      lastTriedAt: row.lastTriedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Fecha a conexão com o banco
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}
