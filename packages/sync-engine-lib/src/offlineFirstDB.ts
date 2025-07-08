import * as SQLite from "expo-sqlite";
import { SyncAdapter } from "./adapters/SyncAdapter";
import { EntityMetadata, EntityStatus, QueueStorage } from "./queueStorage";

export type EntitySchemaField =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "json";

export interface EntitySchema {
  [fieldName: string]: EntitySchemaField;
}

export interface EntityConfig {
  schema: EntitySchema;
  tableName?: string;
}

export interface OfflineFirstDBConfig {
  dbName?: string;
  syncAdapter: SyncAdapter;
  entities: Record<string, EntityConfig>;
  enableBackgroundSync?: boolean;
}

export interface EntityWithMetadata {
  [key: string]: any;
  _status: EntityStatus;
  _server_id?: string;
  _version: number;
  _created_at: number;
  _updated_at: number;
  _deleted_at?: number;
}

type EntityWithoutMetadata<T> = Omit<T, keyof EntityMetadata>;

export class OfflineFirstDB {
  private db: SQLite.SQLiteDatabase | null = null;
  private queueStorage: QueueStorage;
  private syncAdapter: SyncAdapter;
  private entities: Record<string, EntityConfig>;
  private initialized = false;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(config: OfflineFirstDBConfig) {
    this.syncAdapter = config.syncAdapter;
    this.entities = config.entities;
    this.queueStorage = new QueueStorage({
      dbName: config.dbName || "offline_first.db",
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.queueStorage.initialize();

      this.db = await SQLite.openDatabaseAsync(this.queueStorage["dbName"]);

      await this.createEntityTables();

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize OfflineFirstDB: ${error}`);
    }
  }

  private async createEntityTables(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    for (const [entityName, config] of Object.entries(this.entities)) {
      const tableName = config.tableName || entityName;
      const fields = this.buildTableFields(config.schema);

      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          ${fields},
          
          -- Sync metadata
          _status TEXT DEFAULT 'new' CHECK (_status IN ('new', 'pending', 'syncing', 'synced', 'conflict', 'failed')),
          _server_id TEXT,
          _version INTEGER DEFAULT 1,
          _created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          _updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          _deleted_at INTEGER
        );
      `);

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${tableName}(_status);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_server_id ON ${tableName}(_server_id);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_updated ON ${tableName}(_updated_at);
      `);
    }
  }

  private buildTableFields(schema: EntitySchema): string {
    return Object.entries(schema)
      .map(([fieldName, fieldType]) => {
        const sqlType = this.getSQLType(fieldType);
        return `${fieldName} ${sqlType}`;
      })
      .join(",\n          ");
  }

  private getSQLType(fieldType: EntitySchemaField): string {
    switch (fieldType) {
      case "string":
        return "TEXT";
      case "number":
        return "REAL";
      case "boolean":
        return "INTEGER";
      case "date":
        return "INTEGER";
      case "json":
        return "TEXT";
      default:
        return "TEXT";
    }
  }

  async create<T extends Record<string, any>>(
    entityName: string,
    data: EntityWithoutMetadata<T>
  ): Promise<EntityWithMetadata> {
    if (!this.db) throw new Error("Database not initialized");

    const tableName = this.entities[entityName]?.tableName || entityName;
    const entityId = this.generateId();
    const now = Date.now();

    const entityData: EntityWithMetadata = {
      id: entityId,
      ...data,
      _status: "pending" as EntityStatus,
      _server_id: undefined,
      _version: 1,
      _created_at: now,
      _updated_at: now,
      _deleted_at: undefined,
    };

    await this.db.withTransactionAsync(async () => {
      const fields = Object.keys(entityData).join(", ");
      const placeholders = Object.keys(entityData)
        .map(() => "?")
        .join(", ");
      const values = Object.values(entityData).map((v) =>
        v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : v
      );

      await this.db!.runAsync(
        `INSERT INTO ${tableName} (${fields}) VALUES (${placeholders})`,
        values
      );

      await this.queueStorage.addOperation(tableName, entityId, "CREATE", data);

      await this.queueStorage.setEntityMetadata(tableName, entityId, {
        _status: "pending",
        _version: 1,
        _created_at: now,
        _updated_at: now,
      });
    });

    this.emit(`${entityName}:created`, entityData);
    this.emit(`${entityName}:changed`, entityData);

    return entityData;
  }

  async findAll<T extends Record<string, any>>(
    entityName: string,
    options?: {
      where?: Partial<T>;
      orderBy?: keyof T;
      order?: "ASC" | "DESC";
      limit?: number;
      offset?: number;
      includeDeleted?: boolean;
    }
  ): Promise<EntityWithMetadata[]> {
    if (!this.db) throw new Error("Database not initialized");

    const tableName = this.entities[entityName]?.tableName || entityName;
    let query = `SELECT * FROM ${tableName}`;
    const params: any[] = [];

    const whereConditions: string[] = [];

    if (!options?.includeDeleted) {
      whereConditions.push("_deleted_at IS NULL");
    }

    if (options?.where) {
      for (const [key, value] of Object.entries(options.where)) {
        if (value !== undefined) {
          whereConditions.push(`${key} = ?`);
          params.push(value);
        }
      }
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    if (options?.orderBy) {
      query += ` ORDER BY ${String(options.orderBy)} ${options.order || "ASC"}`;
    }

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }
    if (options?.offset) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    const results = await this.db.getAllAsync(query, params);
    return results.map((row) => this.deserializeEntity(row));
  }

  async findById<T extends Record<string, any>>(
    entityName: string,
    id: string
  ): Promise<EntityWithMetadata | null> {
    if (!this.db) throw new Error("Database not initialized");

    const tableName = this.entities[entityName]?.tableName || entityName;
    const result = await this.db.getFirstAsync(
      `SELECT * FROM ${tableName} WHERE id = ? AND _deleted_at IS NULL`,
      [id]
    );

    return result ? this.deserializeEntity(result) : null;
  }

  async update<T extends Record<string, any>>(
    entityName: string,
    id: string,
    data: Partial<EntityWithoutMetadata<T>>
  ): Promise<EntityWithMetadata | null> {
    if (!this.db) throw new Error("Database not initialized");

    const tableName = this.entities[entityName]?.tableName || entityName;
    const now = Date.now();

    const currentEntity = await this.findById(entityName, id);
    if (!currentEntity) {
      throw new Error(`Entity ${entityName} with id ${id} not found`);
    }

    const updatedEntity: EntityWithMetadata = {
      ...currentEntity,
      ...data,
      _status: "pending" as EntityStatus,
      _version: currentEntity._version + 1,
      _updated_at: now,
    };

    await this.db.withTransactionAsync(async () => {
      const updateFields = Object.keys(data)
        .map((key) => `${key} = ?`)
        .join(", ");
      const updateValues = Object.values(data).map((v) =>
        typeof v === "object" ? JSON.stringify(v) : v
      );

      await this.db!.runAsync(
        `UPDATE ${tableName} 
         SET ${updateFields}, _status = 'pending', _version = _version + 1, _updated_at = ?
         WHERE id = ?`,
        [...updateValues, now, id]
      );

      await this.queueStorage.addOperation(tableName, id, "UPDATE", data);

      await this.queueStorage.setEntityMetadata(tableName, id, {
        _status: "pending",
        _version: updatedEntity._version,
        _updated_at: now,
      });
    });

    this.emit(`${entityName}:updated`, updatedEntity);
    this.emit(`${entityName}:changed`, updatedEntity);

    return updatedEntity;
  }

  async delete(entityName: string, id: string): Promise<boolean> {
    if (!this.db) throw new Error("Database not initialized");

    const tableName = this.entities[entityName]?.tableName || entityName;
    const now = Date.now();

    const entity = await this.findById(entityName, id);
    if (!entity) {
      return false;
    }

    await this.db.withTransactionAsync(async () => {
      await this.db!.runAsync(
        `UPDATE ${tableName} 
         SET _status = 'pending', _deleted_at = ?, _updated_at = ?
         WHERE id = ?`,
        [now, now, id]
      );

      await this.queueStorage.addOperation(tableName, id, "DELETE", { id });

      await this.queueStorage.setEntityMetadata(tableName, id, {
        _status: "pending",
        _updated_at: now,
        _deleted_at: now,
      });
    });

    this.emit(`${entityName}:deleted`, { id, _deleted_at: now });
    this.emit(`${entityName}:changed`, { id, _deleted_at: now });

    return true;
  }

  async getSyncStatus(entityName?: string): Promise<{
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
    conflicts: number;
  }> {
    const tableName = entityName
      ? this.entities[entityName]?.tableName || entityName
      : undefined;
    const stats = await this.queueStorage.getEntityStats(tableName);

    return {
      pending: stats.pending,
      syncing: stats.syncing,
      synced: stats.synced,
      failed: stats.failed,
      conflicts: stats.conflict,
    };
  }

  async getQueueStatus(): Promise<{
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
  }> {
    return await this.queueStorage.getQueueStats();
  }

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  private generateId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private deserializeEntity(row: any): EntityWithMetadata {
    const entity: any = { ...row };

    for (const [entityName, config] of Object.entries(this.entities)) {
      const tableName = config.tableName || entityName;
      if (
        row.tableName === tableName ||
        Object.keys(this.entities).includes(entityName)
      ) {
        for (const [fieldName, fieldType] of Object.entries(config.schema)) {
          if (
            fieldType === "json" &&
            entity[fieldName] &&
            typeof entity[fieldName] === "string"
          ) {
            try {
              entity[fieldName] = JSON.parse(entity[fieldName]);
            } catch {
              console.warn(
                `Failed to parse JSON field "${fieldName}" for entity "${entityName}"`
              );
            }
          }
        }
        break;
      }
    }

    return entity;
  }

  async close(): Promise<void> {
    await this.queueStorage.close();
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
    this.initialized = false;
    this.eventListeners.clear();
  }
}

export function createEntityDB<T extends Record<string, any>>(
  db: OfflineFirstDB,
  entityName: string
) {
  return {
    async create(data: EntityWithoutMetadata<T>): Promise<EntityWithMetadata> {
      return db.create(entityName, data);
    },

    async findAll(options?: {
      where?: Partial<T>;
      orderBy?: keyof T;
      order?: "ASC" | "DESC";
      limit?: number;
      offset?: number;
      includeDeleted?: boolean;
    }): Promise<EntityWithMetadata[]> {
      return db.findAll<T>(entityName, options);
    },

    async findById(id: string): Promise<EntityWithMetadata | null> {
      return db.findById<T>(entityName, id);
    },

    async update(
      id: string,
      data: Partial<EntityWithoutMetadata<T>>
    ): Promise<EntityWithMetadata | null> {
      return db.update<T>(entityName, id, data);
    },

    async delete(id: string): Promise<boolean> {
      return db.delete(entityName, id);
    },

    async getSyncStatus() {
      return db.getSyncStatus(entityName);
    },

    on(
      event: "created" | "updated" | "deleted" | "changed",
      listener: (data: any) => void
    ): void {
      db.on(`${entityName}:${event}`, listener);
    },

    off(
      event: "created" | "updated" | "deleted" | "changed",
      listener: (data: any) => void
    ): void {
      db.off(`${entityName}:${event}`, listener);
    },
  };
}
