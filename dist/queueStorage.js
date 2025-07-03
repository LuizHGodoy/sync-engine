"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueStorage = void 0;
const SQLite = __importStar(require("expo-sqlite"));
/**
 * Gerenciador de armazenamento da queue usando SQLite
 */
class QueueStorage {
    constructor(dbName = 'sync_engine.db') {
        this.db = null;
        this.dbName = dbName;
    }
    /**
     * Inicializa o banco de dados e cria as tabelas necessárias
     */
    async initialize() {
        try {
            this.db = await SQLite.openDatabaseAsync(this.dbName);
            await this.createTables();
        }
        catch (error) {
            throw new Error(`Erro ao inicializar banco de dados: ${error}`);
        }
    }
    /**
     * Cria as tabelas necessárias
     */
    async createTables() {
        if (!this.db)
            throw new Error('Banco de dados não inicializado');
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
    async addItem(item) {
        if (!this.db)
            throw new Error('Banco de dados não inicializado');
        const now = Date.now();
        const queueItem = {
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
    async getItemsByStatus(status, limit) {
        if (!this.db)
            throw new Error('Banco de dados não inicializado');
        let query = `
      SELECT * FROM sync_queue 
      WHERE status = ? 
      ORDER BY createdAt ASC
    `;
        const params = [status];
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
    async getPendingItems(limit) {
        return this.getItemsByStatus('pending', limit);
    }
    /**
     * Obtém items com erro
     */
    async getErrorItems(limit) {
        return this.getItemsByStatus('error', limit);
    }
    /**
     * Atualiza o status de um item
     */
    async updateItemStatus(id, status, incrementRetries = false) {
        if (!this.db)
            throw new Error('Banco de dados não inicializado');
        const now = Date.now();
        let updateSQL = `
      UPDATE sync_queue 
      SET status = ?, updatedAt = ?, lastTriedAt = ?
    `;
        const params = [status, now, now];
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
    async removeItem(id) {
        if (!this.db)
            throw new Error('Banco de dados não inicializado');
        const deleteSQL = 'DELETE FROM sync_queue WHERE id = ?';
        await this.db.runAsync(deleteSQL, [id]);
    }
    /**
     * Remove todos os items sincronizados
     */
    async removeSyncedItems() {
        if (!this.db)
            throw new Error('Banco de dados não inicializado');
        const deleteSQL = 'DELETE FROM sync_queue WHERE status = ?';
        await this.db.runAsync(deleteSQL, ['synced']);
    }
    /**
     * Obtém estatísticas da queue
     */
    async getQueueStats() {
        if (!this.db)
            throw new Error('Banco de dados não inicializado');
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
            const status = row.status;
            const count = row.count;
            stats[status] = count;
            stats.total += count;
        }
        return stats;
    }
    /**
     * Obtém um item específico por ID
     */
    async getItem(id) {
        if (!this.db)
            throw new Error('Banco de dados não inicializado');
        const selectSQL = 'SELECT * FROM sync_queue WHERE id = ?';
        const result = await this.db.getFirstAsync(selectSQL, [id]);
        if (!result)
            return null;
        return this.mapRowToQueueItem(result);
    }
    /**
     * Limpa toda a queue (uso cuidadoso)
     */
    async clearQueue() {
        if (!this.db)
            throw new Error('Banco de dados não inicializado');
        const deleteSQL = 'DELETE FROM sync_queue';
        await this.db.runAsync(deleteSQL);
    }
    /**
     * Executa uma transação
     */
    async transaction(callback) {
        if (!this.db)
            throw new Error('Banco de dados não inicializado');
        await this.db.withTransactionAsync(callback);
    }
    /**
     * Mapeia uma linha do banco para QueueItem
     */
    mapRowToQueueItem(row) {
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
    async close() {
        if (this.db) {
            await this.db.closeAsync();
            this.db = null;
        }
    }
}
exports.QueueStorage = QueueStorage;
//# sourceMappingURL=queueStorage.js.map