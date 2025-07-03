"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncEngine = void 0;
const react_native_1 = require("react-native");
const queueStorage_1 = require("./queueStorage");
const netMonitor_1 = require("./netMonitor");
const retryPolicy_1 = require("./retryPolicy");
const conflictResolver_1 = require("./conflictResolver");
/**
 * Engine principal de sincronização bidirecional
 */
class SyncEngine {
    constructor(options) {
        this.isInitialized = false;
        this.isSyncing = false;
        this.isActive = false;
        this.listeners = [];
        this.config = options.config;
        this.hooks = options.hooks || {};
        this.debug = options.debug || false;
        // Inicializa componentes
        this.storage = new queueStorage_1.QueueStorage();
        this.netMonitor = new netMonitor_1.NetMonitor();
        this.retryPolicy = retryPolicy_1.RetryPolicies.default();
        this.conflictResolver = new conflictResolver_1.ConflictResolver(options.conflictStrategy || conflictResolver_1.ConflictStrategies.timestampWins());
        this.setupRetryPolicy();
        this.bindMethods();
    }
    /**
     * Inicializa a engine de sincronização
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            this.log('Inicializando Sync Engine...');
            // Inicializa componentes
            await this.storage.initialize();
            await this.netMonitor.initialize();
            // Configura listeners
            this.setupNetworkListener();
            this.setupAppStateListener();
            this.isInitialized = true;
            this.log('Sync Engine inicializada com sucesso');
        }
        catch (error) {
            this.log('Erro ao inicializar Sync Engine:', error);
            throw error;
        }
    }
    /**
     * Inicia a sincronização automática
     */
    async start() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.log('Iniciando sincronização automática');
        // Executa sync inicial se estiver online
        if (this.netMonitor.getConnectionStatus()) {
            await this.forceSync();
        }
        // Configura intervalo de sync automático
        this.setupSyncInterval();
        this.emitEvent('sync_started', { autoSync: true });
    }
    /**
     * Para a sincronização automática
     */
    stop() {
        if (!this.isActive) {
            return;
        }
        this.isActive = false;
        this.log('Parando sincronização automática');
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = undefined;
        }
        this.emitEvent('sync_started', { autoSync: false });
    }
    /**
     * Adiciona um item à queue de sincronização
     */
    async addToQueue(id, type, payload, status = 'pending') {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            await this.storage.addItem({
                id,
                type,
                payload,
                status,
            });
            this.log(`Item adicionado à queue: ${id} (${type})`);
            this.emitEvent('item_queued', { id, type, payload });
            // Executa hooks
            await this.executeHook('onQueueChange', await this.getStatus());
            // Se estiver online e ativo, tenta sincronizar imediatamente
            if (this.isActive && this.netMonitor.getConnectionStatus() && !this.isSyncing) {
                setTimeout(() => this.forceSync(), 100);
            }
        }
        catch (error) {
            this.log('Erro ao adicionar item à queue:', error);
            throw error;
        }
    }
    /**
     * Força uma sincronização imediata
     */
    async forceSync() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (this.isSyncing) {
            this.log('Sync já em execução, aguardando...');
            await this.waitForSyncCompletion();
            return { success: true, syncedItems: 0, errors: 0 };
        }
        if (!this.netMonitor.getConnectionStatus()) {
            this.log('Sem conexão, sync cancelado');
            return { success: false, syncedItems: 0, errors: 0 };
        }
        this.isSyncing = true;
        let syncedItems = 0;
        let errors = 0;
        try {
            this.log('Iniciando sincronização forçada');
            this.emitEvent('sync_started');
            // Obtém items pendentes
            const pendingItems = await this.storage.getPendingItems(this.config.batchSize);
            if (pendingItems.length === 0) {
                this.log('Nenhum item pendente para sincronizar');
                return { success: true, syncedItems: 0, errors: 0 };
            }
            this.log(`Sincronizando ${pendingItems.length} items`);
            // Executa hook antes do sync
            await this.executeHook('onBeforeSync', pendingItems);
            // Processa items em batch
            for (const item of pendingItems) {
                try {
                    await this.syncItem(item);
                    syncedItems++;
                    this.emitEvent('item_synced', { item });
                }
                catch (error) {
                    errors++;
                    this.log(`Erro ao sincronizar item ${item.id}:`, error);
                    this.emitEvent('item_failed', { item, error });
                }
            }
            // Executa hook após sync
            await this.executeHook('onSyncSuccess', pendingItems);
            this.lastSync = Date.now();
            this.log(`Sync completo: ${syncedItems} sincronizados, ${errors} erros`);
            this.emitEvent('sync_completed', { syncedItems, errors });
            return { success: errors === 0, syncedItems, errors };
        }
        catch (error) {
            this.log('Erro durante sincronização:', error);
            this.emitEvent('sync_failed', { error });
            await this.executeHook('onSyncError', error, []);
            throw error;
        }
        finally {
            this.isSyncing = false;
        }
    }
    /**
     * Obtém o status atual da sincronização
     */
    async getStatus() {
        if (!this.isInitialized) {
            return {
                isActive: false,
                pendingItems: 0,
                errorItems: 0,
                isOnline: false,
                isSyncing: false,
            };
        }
        const stats = await this.storage.getQueueStats();
        return {
            isActive: this.isActive,
            lastSync: this.lastSync,
            pendingItems: stats.pending,
            errorItems: stats.error,
            isOnline: this.netMonitor.getConnectionStatus(),
            isSyncing: this.isSyncing,
        };
    }
    /**
     * Adiciona um listener de eventos
     */
    addEventListener(listener) {
        this.listeners.push(listener);
    }
    /**
     * Remove um listener de eventos
     */
    removeEventListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    /**
     * Limpa items sincronizados antigos
     */
    async clearSyncedItems() {
        await this.storage.removeSyncedItems();
        this.log('Items sincronizados removidos');
    }
    /**
     * Reinicia items com erro
     */
    async retryFailedItems() {
        const errorItems = await this.storage.getErrorItems();
        for (const item of errorItems) {
            await this.storage.updateItemStatus(item.id, 'pending');
        }
        this.log(`${errorItems.length} items com erro foram marcados para retry`);
        if (this.isActive && this.netMonitor.getConnectionStatus()) {
            await this.forceSync();
        }
    }
    /**
     * Finaliza a engine
     */
    async destroy() {
        this.log('Finalizando Sync Engine');
        this.stop();
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
        }
        this.netMonitor.destroy();
        await this.storage.close();
        this.listeners = [];
        this.isInitialized = false;
    }
    // Métodos privados
    async syncItem(item) {
        return this.retryPolicy.executeWithRetry(async () => {
            const response = await this.sendToServer(item);
            if (response.success) {
                await this.storage.updateItemStatus(item.id, 'synced');
            }
            else if (response.conflicts && response.conflicts.length > 0) {
                // Resolve conflitos
                const conflict = response.conflicts[0];
                const resolvedItem = await this.conflictResolver.resolve(item, conflict.serverData);
                // Atualiza o item resolvido
                await this.storage.removeItem(item.id);
                await this.storage.addItem({
                    id: resolvedItem.id,
                    type: resolvedItem.type,
                    payload: resolvedItem.payload,
                    status: 'pending',
                });
            }
            else {
                throw new Error(response.error || 'Erro desconhecido no servidor');
            }
        }, (attempt, error) => {
            this.log(`Retry ${attempt} para item ${item.id}:`, error.message);
            this.storage.updateItemStatus(item.id, 'error', true);
        });
    }
    async sendToServer(item) {
        const endpoint = `${this.config.serverUrl}/sync`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.config.headers,
            },
            body: JSON.stringify({
                id: item.id,
                type: item.type,
                payload: item.payload,
                timestamp: item.updatedAt,
            }),
            signal: (new AbortController()).signal,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    }
    setupRetryPolicy() {
        this.retryPolicy = new retryPolicy_1.RetryPolicy({
            initialDelay: this.config.initialRetryDelay,
            multiplier: this.config.backoffMultiplier,
            maxDelay: this.config.initialRetryDelay * 10,
            maxRetries: this.config.maxRetries,
        });
    }
    setupNetworkListener() {
        this.netMonitor.addEventListener((event) => {
            if (event.type === 'connection_changed') {
                this.emitEvent('connection_changed', event.data);
                if (event.data?.isOnline && this.isActive && !this.isSyncing) {
                    setTimeout(() => this.forceSync(), 1000);
                }
            }
        });
    }
    setupAppStateListener() {
        this.appStateSubscription = react_native_1.AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active' && this.isActive && this.netMonitor.getConnectionStatus() && !this.isSyncing) {
                setTimeout(() => this.forceSync(), 500);
            }
        });
    }
    setupSyncInterval() {
        if (this.config.syncInterval > 0) {
            this.syncInterval = setInterval(() => {
                if (this.isActive && this.netMonitor.getConnectionStatus() && !this.isSyncing) {
                    this.forceSync();
                }
            }, this.config.syncInterval);
        }
    }
    async waitForSyncCompletion(timeout = 30000) {
        const startTime = Date.now();
        while (this.isSyncing && (Date.now() - startTime) < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    async executeHook(hookName, ...args) {
        const hook = this.hooks?.[hookName];
        if (hook) {
            try {
                await hook(...args);
            }
            catch (error) {
                this.log(`Erro ao executar hook ${hookName}:`, error);
            }
        }
    }
    emitEvent(type, data, error) {
        const event = {
            type,
            timestamp: Date.now(),
            data,
            error,
        };
        this.listeners.forEach(listener => {
            try {
                listener(event);
            }
            catch (error) {
                this.log('Erro ao notificar listener:', error);
            }
        });
    }
    bindMethods() {
        this.forceSync = this.forceSync.bind(this);
        this.addToQueue = this.addToQueue.bind(this);
    }
    log(...args) {
        if (this.debug) {
            console.log('[SyncEngine]', ...args);
        }
    }
}
exports.SyncEngine = SyncEngine;
//# sourceMappingURL=syncEngine.js.map