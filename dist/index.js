"use strict";
/**
 * Sync Engine Lib - Biblioteca de sincronização bidirecional offline-first
 * para React Native/Expo
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncEngineFactory = exports.SyncEngineConstants = exports.SyncEngineUtils = exports.ConflictUtils = exports.ConflictStrategies = exports.ConflictResolver = exports.RetryPolicies = exports.RetryPolicy = exports.NetMonitor = exports.QueueStorage = exports.SyncEngine = void 0;
// Exporta a classe principal
var syncEngine_1 = require("./syncEngine");
Object.defineProperty(exports, "SyncEngine", { enumerable: true, get: function () { return syncEngine_1.SyncEngine; } });
// Exporta componentes individuais
var queueStorage_1 = require("./queueStorage");
Object.defineProperty(exports, "QueueStorage", { enumerable: true, get: function () { return queueStorage_1.QueueStorage; } });
var netMonitor_1 = require("./netMonitor");
Object.defineProperty(exports, "NetMonitor", { enumerable: true, get: function () { return netMonitor_1.NetMonitor; } });
var retryPolicy_1 = require("./retryPolicy");
Object.defineProperty(exports, "RetryPolicy", { enumerable: true, get: function () { return retryPolicy_1.RetryPolicy; } });
Object.defineProperty(exports, "RetryPolicies", { enumerable: true, get: function () { return retryPolicy_1.RetryPolicies; } });
var conflictResolver_1 = require("./conflictResolver");
Object.defineProperty(exports, "ConflictResolver", { enumerable: true, get: function () { return conflictResolver_1.ConflictResolver; } });
Object.defineProperty(exports, "ConflictStrategies", { enumerable: true, get: function () { return conflictResolver_1.ConflictStrategies; } });
Object.defineProperty(exports, "ConflictUtils", { enumerable: true, get: function () { return conflictResolver_1.ConflictUtils; } });
// Importa tipos e classes necessárias
const syncEngine_2 = require("./syncEngine");
const conflictResolver_2 = require("./conflictResolver");
// Utilitários e helpers
exports.SyncEngineUtils = {
    /**
     * Cria uma configuração padrão para o SyncEngine
     */
    createDefaultConfig: (serverUrl) => ({
        serverUrl,
        batchSize: 10,
        syncInterval: 30000, // 30 segundos
        maxRetries: 3,
        initialRetryDelay: 1000, // 1 segundo
        backoffMultiplier: 2,
        requestTimeout: 10000, // 10 segundos
    }),
    /**
     * Gera um ID único para items da queue
     */
    generateId: () => {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    /**
     * Valida se uma configuração está correta
     */
    validateConfig: (config) => {
        const errors = [];
        if (!config.serverUrl || !config.serverUrl.trim()) {
            errors.push('serverUrl é obrigatório');
        }
        if (config.batchSize <= 0) {
            errors.push('batchSize deve ser maior que 0');
        }
        if (config.maxRetries < 0) {
            errors.push('maxRetries deve ser maior ou igual a 0');
        }
        if (config.initialRetryDelay < 0) {
            errors.push('initialRetryDelay deve ser maior ou igual a 0');
        }
        if (config.backoffMultiplier <= 1) {
            errors.push('backoffMultiplier deve ser maior que 1');
        }
        if (config.requestTimeout <= 0) {
            errors.push('requestTimeout deve ser maior que 0');
        }
        try {
            new URL(config.serverUrl);
        }
        catch {
            errors.push('serverUrl deve ser uma URL válida');
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    },
    /**
     * Cria opções padrão para o SyncEngine
     */
    createDefaultOptions: (config) => ({
        config,
        conflictStrategy: conflictResolver_2.ConflictStrategies.timestampWins(),
        debug: false,
    }),
};
// Constantes úteis
exports.SyncEngineConstants = {
    /**
     * Intervalos de sync comuns (em ms)
     */
    SYNC_INTERVALS: {
        VERY_FAST: 5000, // 5 segundos
        FAST: 15000, // 15 segundos
        NORMAL: 30000, // 30 segundos
        SLOW: 60000, // 1 minuto
        VERY_SLOW: 300000, // 5 minutos
    },
    /**
     * Tamanhos de batch comuns
     */
    BATCH_SIZES: {
        SMALL: 5,
        MEDIUM: 10,
        LARGE: 25,
        VERY_LARGE: 50,
    },
    /**
     * Timeouts comuns (em ms)
     */
    TIMEOUTS: {
        FAST: 5000, // 5 segundos
        NORMAL: 10000, // 10 segundos
        SLOW: 30000, // 30 segundos
    },
    /**
     * Delays de retry comuns (em ms)
     */
    RETRY_DELAYS: {
        FAST: 500, // 0.5 segundos
        NORMAL: 1000, // 1 segundo
        SLOW: 2000, // 2 segundos
    },
};
// Factory para criar instâncias pré-configuradas
exports.SyncEngineFactory = {
    /**
     * Cria um SyncEngine para desenvolvimento (com logs habilitados)
     */
    createForDevelopment: (serverUrl, options) => {
        const config = exports.SyncEngineUtils.createDefaultConfig(serverUrl);
        return new syncEngine_2.SyncEngine({
            config: {
                ...config,
                syncInterval: exports.SyncEngineConstants.SYNC_INTERVALS.FAST,
                ...options?.config,
            },
            conflictStrategy: conflictResolver_2.ConflictStrategies.timestampWins(),
            debug: true,
            ...options,
        });
    },
    /**
     * Cria um SyncEngine para produção (otimizado)
     */
    createForProduction: (serverUrl, options) => {
        const config = exports.SyncEngineUtils.createDefaultConfig(serverUrl);
        return new syncEngine_2.SyncEngine({
            config: {
                ...config,
                syncInterval: exports.SyncEngineConstants.SYNC_INTERVALS.NORMAL,
                batchSize: exports.SyncEngineConstants.BATCH_SIZES.LARGE,
                ...options?.config,
            },
            conflictStrategy: conflictResolver_2.ConflictStrategies.timestampWins(),
            debug: false,
            ...options,
        });
    },
    /**
     * Cria um SyncEngine conservador (para dados críticos)
     */
    createConservative: (serverUrl, options) => {
        const config = exports.SyncEngineUtils.createDefaultConfig(serverUrl);
        return new syncEngine_2.SyncEngine({
            config: {
                ...config,
                syncInterval: exports.SyncEngineConstants.SYNC_INTERVALS.SLOW,
                batchSize: exports.SyncEngineConstants.BATCH_SIZES.SMALL,
                maxRetries: 5,
                initialRetryDelay: exports.SyncEngineConstants.RETRY_DELAYS.SLOW,
                requestTimeout: exports.SyncEngineConstants.TIMEOUTS.SLOW,
                ...options?.config,
            },
            conflictStrategy: conflictResolver_2.ConflictStrategies.manual(),
            debug: false,
            ...options,
        });
    },
    /**
     * Cria um SyncEngine agressivo (para sincronização rápida)
     */
    createAggressive: (serverUrl, options) => {
        const config = exports.SyncEngineUtils.createDefaultConfig(serverUrl);
        return new syncEngine_2.SyncEngine({
            config: {
                ...config,
                syncInterval: exports.SyncEngineConstants.SYNC_INTERVALS.VERY_FAST,
                batchSize: exports.SyncEngineConstants.BATCH_SIZES.VERY_LARGE,
                maxRetries: 2,
                initialRetryDelay: exports.SyncEngineConstants.RETRY_DELAYS.FAST,
                requestTimeout: exports.SyncEngineConstants.TIMEOUTS.FAST,
                ...options?.config,
            },
            conflictStrategy: conflictResolver_2.ConflictStrategies.clientWins(),
            debug: false,
            ...options,
        });
    },
};
//# sourceMappingURL=index.js.map