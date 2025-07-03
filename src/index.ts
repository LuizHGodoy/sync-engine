/**
 * Sync Engine Lib - Biblioteca de sincronização bidirecional offline-first
 * para React Native/Expo
 */

// Exporta a classe principal
export { SyncEngine } from './syncEngine';

// Exporta componentes individuais
export { QueueStorage } from './queueStorage';
export { NetMonitor } from './netMonitor';
export { RetryPolicy, RetryPolicies } from './retryPolicy';
export { ConflictResolver, ConflictStrategies, ConflictUtils } from './conflictResolver';

// Exporta todos os tipos
export type {
  QueueItem,
  SyncConfig,
  SyncStatus,
  SyncEngineOptions,
  SyncHooks,
  ConflictResolutionStrategy,
  ServerResponse,
  BackoffConfig,
  SyncEventType,
  SyncEvent,
  SyncEventListener,
} from './types';

// Importa tipos e classes necessárias
import { SyncEngine } from './syncEngine';
import { ConflictStrategies } from './conflictResolver';
import {
  SyncConfig,
  SyncEngineOptions,
} from './types';

// Utilitários e helpers
export const SyncEngineUtils = {
  /**
   * Cria uma configuração padrão para o SyncEngine
   */
  createDefaultConfig: (serverUrl: string): SyncConfig => ({
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
  generateId: (): string => {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Valida se uma configuração está correta
   */
  validateConfig: (config: SyncConfig): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

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
    } catch {
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
  createDefaultOptions: (config: SyncConfig): SyncEngineOptions => ({
    config,
    conflictStrategy: ConflictStrategies.timestampWins(),
    debug: false,
  }),
};

// Constantes úteis
export const SyncEngineConstants = {
  /**
   * Intervalos de sync comuns (em ms)
   */
  SYNC_INTERVALS: {
    VERY_FAST: 5000,    // 5 segundos
    FAST: 15000,        // 15 segundos
    NORMAL: 30000,      // 30 segundos
    SLOW: 60000,        // 1 minuto
    VERY_SLOW: 300000,  // 5 minutos
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
    FAST: 5000,    // 5 segundos
    NORMAL: 10000, // 10 segundos
    SLOW: 30000,   // 30 segundos
  },

  /**
   * Delays de retry comuns (em ms)
   */
  RETRY_DELAYS: {
    FAST: 500,    // 0.5 segundos
    NORMAL: 1000, // 1 segundo
    SLOW: 2000,   // 2 segundos
  },
};

// Factory para criar instâncias pré-configuradas
export const SyncEngineFactory = {
  /**
   * Cria um SyncEngine para desenvolvimento (com logs habilitados)
   */
  createForDevelopment: (serverUrl: string, options?: Partial<SyncEngineOptions>) => {
    const config = SyncEngineUtils.createDefaultConfig(serverUrl);
    
    return new SyncEngine({
      config: {
        ...config,
        syncInterval: SyncEngineConstants.SYNC_INTERVALS.FAST,
        ...options?.config,
      },
      conflictStrategy: ConflictStrategies.timestampWins(),
      debug: true,
      ...options,
    });
  },

  /**
   * Cria um SyncEngine para produção (otimizado)
   */
  createForProduction: (serverUrl: string, options?: Partial<SyncEngineOptions>) => {
    const config = SyncEngineUtils.createDefaultConfig(serverUrl);
    
    return new SyncEngine({
      config: {
        ...config,
        syncInterval: SyncEngineConstants.SYNC_INTERVALS.NORMAL,
        batchSize: SyncEngineConstants.BATCH_SIZES.LARGE,
        ...options?.config,
      },
      conflictStrategy: ConflictStrategies.timestampWins(),
      debug: false,
      ...options,
    });
  },

  /**
   * Cria um SyncEngine conservador (para dados críticos)
   */
  createConservative: (serverUrl: string, options?: Partial<SyncEngineOptions>) => {
    const config = SyncEngineUtils.createDefaultConfig(serverUrl);
    
    return new SyncEngine({
      config: {
        ...config,
        syncInterval: SyncEngineConstants.SYNC_INTERVALS.SLOW,
        batchSize: SyncEngineConstants.BATCH_SIZES.SMALL,
        maxRetries: 5,
        initialRetryDelay: SyncEngineConstants.RETRY_DELAYS.SLOW,
        requestTimeout: SyncEngineConstants.TIMEOUTS.SLOW,
        ...options?.config,
      },
      conflictStrategy: ConflictStrategies.manual(),
      debug: false,
      ...options,
    });
  },

  /**
   * Cria um SyncEngine agressivo (para sincronização rápida)
   */
  createAggressive: (serverUrl: string, options?: Partial<SyncEngineOptions>) => {
    const config = SyncEngineUtils.createDefaultConfig(serverUrl);
    
    return new SyncEngine({
      config: {
        ...config,
        syncInterval: SyncEngineConstants.SYNC_INTERVALS.VERY_FAST,
        batchSize: SyncEngineConstants.BATCH_SIZES.VERY_LARGE,
        maxRetries: 2,
        initialRetryDelay: SyncEngineConstants.RETRY_DELAYS.FAST,
        requestTimeout: SyncEngineConstants.TIMEOUTS.FAST,
        ...options?.config,
      },
      conflictStrategy: ConflictStrategies.clientWins(),
      debug: false,
      ...options,
    });
  },
};
