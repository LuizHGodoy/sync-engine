import * as SQLite from "expo-sqlite";

export type EntityStatus =
  | "new"
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";
export type OperationType = "CREATE" | "UPDATE" | "DELETE";
export type OutboxStatus = "pending" | "syncing" | "synced" | "failed";

export interface OutboxOperation {
  id: string;
  entity_table: string;
  entity_id: string;
  operation: OperationType;
  data: string;
  status: OutboxStatus;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: number;
  created_at: number;
  updated_at: number;
}

export interface EntityMetadata {
  _status: EntityStatus;
  _server_id?: string;
  _version: number;
  _created_at: number;
  _updated_at: number;
  _deleted_at?: number;
}

export interface QueueStorageConfig {
  dbName?: string;
  maxRetries?: number;
  batchSize?: number;
}

export class QueueStorage {
  private db: SQLite.SQLiteDatabase | null = null;
  private readonly dbName: string;
  private readonly maxRetries: number;
  private readonly batchSize: number;
  private initialized = false;

  constructor(config: QueueStorageConfig = {}) {
    this.dbName = config.dbName || "offline_first.db";
    this.maxRetries = config.maxRetries || 5;
    this.batchSize = config.batchSize || 50;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.db = await SQLite.openDatabaseAsync(this.dbName);
      await this.createTables();
      await this.createIndexes();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize QueueStorage: ${error}`);
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        entity_table TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
        data TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'failed')),
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT ${this.maxRetries},
        next_retry_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS entity_metadata (
        table_name TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'pending', 'syncing', 'synced', 'conflict', 'failed')),
        server_id TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        deleted_at INTEGER,
        PRIMARY KEY (table_name, entity_id)
      );
    `);
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
      CREATE INDEX IF NOT EXISTS idx_outbox_retry ON outbox(next_retry_at) WHERE status = 'failed';
      CREATE INDEX IF NOT EXISTS idx_outbox_entity ON outbox(entity_table, entity_id);
      CREATE INDEX IF NOT EXISTS idx_metadata_status ON entity_metadata(status);
      CREATE INDEX IF NOT EXISTS idx_metadata_table ON entity_metadata(table_name);
    `);
  }

  async addOperation(
    entityTable: string,
    entityId: string,
    operation: OperationType,
    data?: any
  ): Promise<string> {
    if (!this.db) throw new Error("Database not initialized");

    const operationId = `op_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const now = Date.now();

    await this.db.runAsync(
      `INSERT INTO outbox (id, entity_table, entity_id, operation, data, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        operationId,
        entityTable,
        entityId,
        operation,
        JSON.stringify(data || {}),
        now,
        now,
      ]
    );

    return operationId;
  }

  async getPendingOperations(
    limit: number = this.batchSize
  ): Promise<OutboxOperation[]> {
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getAllAsync<OutboxOperation>(
      `SELECT * FROM outbox 
       WHERE status = 'pending' OR (status = 'failed' AND next_retry_at <= ?)
       ORDER BY created_at ASC 
       LIMIT ?`,
      [Date.now(), limit]
    );

    return result;
  }

  async updateOperationStatus(
    operationId: string,
    status: OutboxStatus,
    errorMessage?: string
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const now = Date.now();

    if (status === "failed") {
      await this.db.runAsync(
        `UPDATE outbox 
         SET status = ?, error_message = ?, retry_count = retry_count + 1, 
             next_retry_at = ?, updated_at = ?
         WHERE id = ?`,
        [
          status,
          errorMessage || null,
          this.calculateNextRetry(),
          now,
          operationId,
        ]
      );
    } else {
      await this.db.runAsync(
        `UPDATE outbox 
         SET status = ?, error_message = ?, updated_at = ?
         WHERE id = ?`,
        [status, errorMessage || null, now, operationId]
      );
    }
  }

  async removeOperation(operationId: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.runAsync(`DELETE FROM outbox WHERE id = ?`, [operationId]);
  }

  async batchUpdateOperations(
    updates: Array<{
      id: string;
      status: OutboxStatus;
      errorMessage?: string;
    }>
  ): Promise<void> {
    if (!this.db || updates.length === 0) return;

    await this.db.withTransactionAsync(async () => {
      for (const update of updates) {
        await this.updateOperationStatus(
          update.id,
          update.status,
          update.errorMessage
        );
      }
    });
  }

  async setEntityMetadata(
    tableName: string,
    entityId: string,
    metadata: Partial<EntityMetadata>
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const now = Date.now();

    await this.db.runAsync(
      `INSERT OR REPLACE INTO entity_metadata 
       (table_name, entity_id, status, server_id, version, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, 
               COALESCE((SELECT created_at FROM entity_metadata WHERE table_name = ? AND entity_id = ?), ?),
               ?, ?)`,
      [
        tableName,
        entityId,
        metadata._status || "new",
        metadata._server_id || null,
        metadata._version || 1,
        tableName,
        entityId,
        metadata._created_at || now,
        metadata._updated_at || now,
        metadata._deleted_at || null,
      ]
    );
  }

  async getEntityMetadata(
    tableName: string,
    entityId: string
  ): Promise<EntityMetadata | null> {
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getFirstAsync<{
      status: EntityStatus;
      server_id?: string;
      version: number;
      created_at: number;
      updated_at: number;
      deleted_at?: number;
    }>(
      `SELECT status, server_id, version, created_at, updated_at, deleted_at 
       FROM entity_metadata 
       WHERE table_name = ? AND entity_id = ?`,
      [tableName, entityId]
    );

    if (!result) return null;

    return {
      _status: result.status,
      _server_id: result.server_id,
      _version: result.version,
      _created_at: result.created_at,
      _updated_at: result.updated_at,
      _deleted_at: result.deleted_at,
    };
  }

  async updateEntityStatus(
    tableName: string,
    entityId: string,
    status: EntityStatus,
    serverId?: string
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const now = Date.now();

    await this.db.runAsync(
      `UPDATE entity_metadata 
       SET status = ?, server_id = COALESCE(?, server_id), updated_at = ?
       WHERE table_name = ? AND entity_id = ?`,
      [status, serverId || null, now, tableName, entityId]
    );
  }

  async getQueueStats(): Promise<{
    pending: number;
    syncing: number;
    failed: number;
    synced: number;
  }> {
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getFirstAsync<{
      pending: number;
      syncing: number;
      failed: number;
      synced: number;
    }>(
      `SELECT 
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'syncing' THEN 1 ELSE 0 END) as syncing,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN status = 'synced' THEN 1 ELSE 0 END) as synced
       FROM outbox`
    );

    return result || { pending: 0, syncing: 0, failed: 0, synced: 0 };
  }

  async getEntityStats(tableName?: string): Promise<{
    new: number;
    pending: number;
    syncing: number;
    synced: number;
    conflict: number;
    failed: number;
  }> {
    if (!this.db) throw new Error("Database not initialized");

    const whereClause = tableName ? "WHERE table_name = ?" : "";
    const params = tableName ? [tableName] : [];

    const result = await this.db.getFirstAsync<{
      new: number;
      pending: number;
      syncing: number;
      synced: number;
      conflict: number;
      failed: number;
    }>(
      `SELECT 
         SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'syncing' THEN 1 ELSE 0 END) as syncing,
         SUM(CASE WHEN status = 'synced' THEN 1 ELSE 0 END) as synced,
         SUM(CASE WHEN status = 'conflict' THEN 1 ELSE 0 END) as conflict,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM entity_metadata ${whereClause}`,
      params
    );

    return (
      result || {
        new: 0,
        pending: 0,
        syncing: 0,
        synced: 0,
        conflict: 0,
        failed: 0,
      }
    );
  }

  async cleanupSyncedOperations(olderThanDays: number = 7): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const result = await this.db.runAsync(
      `DELETE FROM outbox 
       WHERE status = 'synced' AND updated_at < ?`,
      [cutoffTime]
    );

    return result.changes;
  }

  async resetFailedOperations(): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.runAsync(
      `UPDATE outbox 
       SET status = 'pending', retry_count = 0, next_retry_at = NULL, error_message = NULL
       WHERE status = 'failed'`
    );

    return result.changes;
  }

  private calculateNextRetry(retryCount: number = 0): number {
    const baseDelay = 1000;
    const maxDelay = 300000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

    const jitter = delay * 0.1 * (Math.random() * 2 - 1);

    return Date.now() + delay + jitter;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.initialized = false;
    }
  }
}
