/**
 * Sync Engine Lib - Biblioteca de sincronização bidirecional offline-first
 * para React Native/Expo
 */
export { SyncEngine } from './syncEngine';
export { QueueStorage } from './queueStorage';
export { NetMonitor } from './netMonitor';
export { RetryPolicy, RetryPolicies } from './retryPolicy';
export { ConflictResolver, ConflictStrategies, ConflictUtils } from './conflictResolver';
export type { QueueItem, SyncConfig, SyncStatus, SyncEngineOptions, SyncHooks, ConflictResolutionStrategy, ServerResponse, BackoffConfig, SyncEventType, SyncEvent, SyncEventListener, } from './types';
import { SyncEngine } from './syncEngine';
import { SyncConfig, SyncEngineOptions } from './types';
export declare const SyncEngineUtils: {
    /**
     * Cria uma configuração padrão para o SyncEngine
     */
    createDefaultConfig: (serverUrl: string) => SyncConfig;
    /**
     * Gera um ID único para items da queue
     */
    generateId: () => string;
    /**
     * Valida se uma configuração está correta
     */
    validateConfig: (config: SyncConfig) => {
        valid: boolean;
        errors: string[];
    };
    /**
     * Cria opções padrão para o SyncEngine
     */
    createDefaultOptions: (config: SyncConfig) => SyncEngineOptions;
};
export declare const SyncEngineConstants: {
    /**
     * Intervalos de sync comuns (em ms)
     */
    SYNC_INTERVALS: {
        VERY_FAST: number;
        FAST: number;
        NORMAL: number;
        SLOW: number;
        VERY_SLOW: number;
    };
    /**
     * Tamanhos de batch comuns
     */
    BATCH_SIZES: {
        SMALL: number;
        MEDIUM: number;
        LARGE: number;
        VERY_LARGE: number;
    };
    /**
     * Timeouts comuns (em ms)
     */
    TIMEOUTS: {
        FAST: number;
        NORMAL: number;
        SLOW: number;
    };
    /**
     * Delays de retry comuns (em ms)
     */
    RETRY_DELAYS: {
        FAST: number;
        NORMAL: number;
        SLOW: number;
    };
};
export declare const SyncEngineFactory: {
    /**
     * Cria um SyncEngine para desenvolvimento (com logs habilitados)
     */
    createForDevelopment: (serverUrl: string, options?: Partial<SyncEngineOptions>) => SyncEngine;
    /**
     * Cria um SyncEngine para produção (otimizado)
     */
    createForProduction: (serverUrl: string, options?: Partial<SyncEngineOptions>) => SyncEngine;
    /**
     * Cria um SyncEngine conservador (para dados críticos)
     */
    createConservative: (serverUrl: string, options?: Partial<SyncEngineOptions>) => SyncEngine;
    /**
     * Cria um SyncEngine agressivo (para sincronização rápida)
     */
    createAggressive: (serverUrl: string, options?: Partial<SyncEngineOptions>) => SyncEngine;
};
//# sourceMappingURL=index.d.ts.map