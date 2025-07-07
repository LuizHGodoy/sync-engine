import * as SQLite from "expo-sqlite";
import { QueueItem } from "./types";

interface PreparedStatements {
  insertItem?: SQLite.SQLiteStatement;
  updateStatus?: SQLite.SQLiteStatement;
  deleteItem?: SQLite.SQLiteStatement;
  selectPending?: SQLite.SQLiteStatement;
  selectStats?: SQLite.SQLiteStatement;
}

export class QueueStorage {
  private db: SQLite.SQLiteDatabase | null = null;
  private readonly dbName: string;
  private preparedStatements: PreparedStatements = {};
  private batchOperationQueue: Array<() => Promise<void>> = [];
  private batchTimer?: NodeJS.Timeout;
  private readonly BATCH_DELAY = 50;

  constructor(dbName: string = "sync_engine.db") {
    this.dbName = dbName;
  }

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(this.dbName);
      await this.createTables();
      await this.prepareTables();
    } catch (error) {
      throw new Error(`Erro ao inicializar banco de dados: ${error}`);
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

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
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created ON sync_queue(status, createdAt);
    `;

    await this.db.execAsync(createTableSQL);
    await this.db.execAsync(createIndexSQL);
  }

  private async prepareTables(): Promise<void> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    this.preparedStatements.insertItem = await this.db.prepareAsync(`
      INSERT OR REPLACE INTO sync_queue (id, type, payload, status, retries, lastTriedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.preparedStatements.updateStatus = await this.db.prepareAsync(`
      UPDATE sync_queue 
      SET status = ?, updatedAt = ?, lastTriedAt = ?, retries = CASE WHEN ? THEN retries + 1 ELSE retries END
      WHERE id = ?
    `);

    this.preparedStatements.deleteItem = await this.db.prepareAsync(`
      DELETE FROM sync_queue WHERE id = ?
    `);

    this.preparedStatements.selectPending = await this.db.prepareAsync(`
      SELECT * FROM sync_queue 
      WHERE status = 'pending' 
      ORDER BY createdAt ASC
      LIMIT ?
    `);

    this.preparedStatements.selectStats = await this.db.prepareAsync(`
      SELECT 
        status,
        COUNT(*) as count
      FROM sync_queue 
      GROUP BY status
    `);
  }

  async addItem(
    item: Omit<QueueItem, "retries" | "createdAt" | "updatedAt"> | QueueItem
  ): Promise<void> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    const now = Date.now();
    const queueItem: QueueItem = {
      retries: 0,
      createdAt: now,
      updatedAt: now,
      ...item,
    };

    if (this.preparedStatements.insertItem) {
      await this.preparedStatements.insertItem.executeAsync([
        queueItem.id,
        queueItem.type,
        JSON.stringify(queueItem.payload),
        queueItem.status,
        queueItem.retries,
        queueItem.lastTriedAt || null,
        queueItem.createdAt,
        queueItem.updatedAt,
      ]);
    } else {
      const insertSQL = `
        INSERT OR REPLACE INTO sync_queue (id, type, payload, status, retries, lastTriedAt, createdAt, updatedAt)
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
  }

  async addItems(
    items: Array<
      Omit<QueueItem, "retries" | "createdAt" | "updatedAt"> | QueueItem
    >
  ): Promise<void> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    await this.db.withTransactionAsync(async () => {
      for (const item of items) {
        await this.addItem(item);
      }
    });
  }

  async getItemsByStatus(
    status: QueueItem["status"],
    limit?: number
  ): Promise<QueueItem[]> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    let query = `
      SELECT * FROM sync_queue 
      WHERE status = ? 
      ORDER BY createdAt ASC
    `;

    const params: any[] = [status];

    if (limit && limit > 0) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const result = await this.db.getAllAsync(query, params);
    return result.map(this.mapRowToQueueItem);
  }

  async getPendingItems(limit?: number): Promise<QueueItem[]> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    if (this.preparedStatements.selectPending && limit) {
      const result = await this.preparedStatements.selectPending.executeAsync([
        limit,
      ]);
      const rows = await result.getAllAsync();
      return rows.map(this.mapRowToQueueItem);
    }

    let query = `
      SELECT * FROM sync_queue 
      WHERE status = 'pending' 
      ORDER BY createdAt ASC
    `;

    const params: any[] = [];

    if (limit && limit > 0) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const result = await this.db.getAllAsync(query, params);
    return result.map(this.mapRowToQueueItem);
  }

  async getErrorItems(limit?: number): Promise<QueueItem[]> {
    return this.getItemsByStatus("error", limit);
  }

  async updateItemStatus(
    id: string,
    status: QueueItem["status"],
    incrementRetries: boolean = false
  ): Promise<void> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    const now = Date.now();

    if (this.preparedStatements.updateStatus) {
      await this.preparedStatements.updateStatus.executeAsync([
        status,
        now,
        now,
        incrementRetries,
        id,
      ]);
    } else {
      let updateSQL = `
        UPDATE sync_queue 
        SET status = ?, updatedAt = ?, lastTriedAt = ?
      `;
      const params: any[] = [status, now, now];

      if (incrementRetries) {
        updateSQL += ", retries = retries + 1";
      }

      updateSQL += " WHERE id = ?";
      params.push(id);

      await this.db.runAsync(updateSQL, params);
    }
  }

  async updateItemsStatus(
    ids: string[],
    status: QueueItem["status"],
    incrementRetries: boolean = false
  ): Promise<void> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    await this.db.withTransactionAsync(async () => {
      for (const id of ids) {
        await this.updateItemStatus(id, status, incrementRetries);
      }
    });
  }

  async removeItem(id: string): Promise<void> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    const deleteSQL = "DELETE FROM sync_queue WHERE id = ?";
    await this.db.runAsync(deleteSQL, [id]);
  }

  async removeSyncedItems(): Promise<void> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    const deleteSQL = "DELETE FROM sync_queue WHERE status = ?";
    await this.db.runAsync(deleteSQL, ["synced"]);
  }

  async getQueueStats(): Promise<{
    pending: number;
    synced: number;
    error: number;
    total: number;
  }> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    if (this.preparedStatements.selectStats) {
      const result = await this.preparedStatements.selectStats.executeAsync();
      const rows = await result.getAllAsync();

      const stats = {
        pending: 0,
        synced: 0,
        error: 0,
        total: 0,
      };

      for (const row of rows) {
        const status = (row as any).status;
        const count = (row as any).count;
        stats[status as keyof typeof stats] = count;
        stats.total += count;
      }

      return stats;
    }

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

  async getItem(id: string): Promise<QueueItem | null> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    const selectSQL = "SELECT * FROM sync_queue WHERE id = ?";
    const result = await this.db.getFirstAsync(selectSQL, [id]);

    if (!result) return null;

    return this.mapRowToQueueItem(result);
  }

  async clearQueue(): Promise<void> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    const deleteSQL = "DELETE FROM sync_queue";
    await this.db.runAsync(deleteSQL);
  }

  async transaction(callback: () => Promise<void>): Promise<void> {
    if (!this.db) throw new Error("Banco de dados não inicializado");

    await this.db.withTransactionAsync(callback);
  }

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

  public async getAllItems(): Promise<QueueItem[]> {
    if (!this.db) throw new Error("Banco de dados não inicializado");
    const selectSQL = "SELECT * FROM sync_queue ORDER BY createdAt DESC";
    const result = await this.db.getAllAsync(selectSQL);
    return result.map(this.mapRowToQueueItem);
  }

  async close(): Promise<void> {
    if (this.preparedStatements.insertItem) {
      await this.preparedStatements.insertItem.finalizeAsync();
    }
    if (this.preparedStatements.updateStatus) {
      await this.preparedStatements.updateStatus.finalizeAsync();
    }
    if (this.preparedStatements.deleteItem) {
      await this.preparedStatements.deleteItem.finalizeAsync();
    }
    if (this.preparedStatements.selectPending) {
      await this.preparedStatements.selectPending.finalizeAsync();
    }
    if (this.preparedStatements.selectStats) {
      await this.preparedStatements.selectStats.finalizeAsync();
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.batchOperationQueue = [];

    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }

    this.preparedStatements = {};
  }
}
