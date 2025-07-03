import { QueueItem, ConflictResolutionStrategy } from './types';

/**
 * Resolvedor de conflitos com estratégias pluggáveis
 */
export class ConflictResolver {
  private strategy: ConflictResolutionStrategy;

  constructor(strategy: ConflictResolutionStrategy) {
    this.strategy = strategy;
  }

  /**
   * Resolve um conflito usando a estratégia configurada
   */
  async resolve(localItem: QueueItem, serverItem: any): Promise<QueueItem> {
    try {
      return await this.strategy.resolve(localItem, serverItem);
    } catch (error) {
      throw new Error(`Erro ao resolver conflito: ${error}`);
    }
  }

  /**
   * Muda a estratégia de resolução
   */
  setStrategy(strategy: ConflictResolutionStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Obtém a estratégia atual
   */
  getStrategy(): ConflictResolutionStrategy {
    return this.strategy;
  }
}

/**
 * Estratégias predefinidas de resolução de conflitos
 */
export const ConflictStrategies = {
  /**
   * Cliente sempre vence - mantém a versão local
   */
  clientWins: (): ConflictResolutionStrategy => ({
    name: 'client-wins',
    resolve: async (localItem: QueueItem, _serverItem: any): Promise<QueueItem> => {
      return {
        ...localItem,
        updatedAt: Date.now(),
      };
    },
  }),

  /**
   * Servidor sempre vence - usa a versão do servidor
   */
  serverWins: (): ConflictResolutionStrategy => ({
    name: 'server-wins',
    resolve: async (localItem: QueueItem, serverItem: any): Promise<QueueItem> => {
      return {
        ...localItem,
        payload: serverItem,
        updatedAt: Date.now(),
      };
    },
  }),

  /**
   * Timestamp vence - usa a versão mais recente
   */
  timestampWins: (): ConflictResolutionStrategy => ({
    name: 'timestamp-wins',
    resolve: async (localItem: QueueItem, serverItem: any): Promise<QueueItem> => {
      const serverTimestamp = serverItem.updatedAt || serverItem.timestamp || 0;
      const localTimestamp = localItem.updatedAt;

      if (localTimestamp >= serverTimestamp) {
        return {
          ...localItem,
          updatedAt: Date.now(),
        };
      } else {
        return {
          ...localItem,
          payload: serverItem,
          updatedAt: Date.now(),
        };
      }
    },
  }),

  /**
   * Merge simples - combina propriedades (shallow merge)
   */
  merge: (): ConflictResolutionStrategy => ({
    name: 'merge',
    resolve: async (localItem: QueueItem, serverItem: any): Promise<QueueItem> => {
      let mergedPayload: any;

      if (typeof localItem.payload === 'object' && typeof serverItem === 'object') {
        mergedPayload = {
          ...serverItem,
          ...localItem.payload,
        };
      } else {
        // Se não são objetos, mantém o local
        mergedPayload = localItem.payload;
      }

      return {
        ...localItem,
        payload: mergedPayload,
        updatedAt: Date.now(),
      };
    },
  }),

  /**
   * Merge inteligente - preserva campos específicos do cliente
   */
  smartMerge: (clientFields: string[] = ['id', 'createdAt']): ConflictResolutionStrategy => ({
    name: 'smart-merge',
    resolve: async (localItem: QueueItem, serverItem: any): Promise<QueueItem> => {
      let mergedPayload: any;

      if (typeof localItem.payload === 'object' && typeof serverItem === 'object') {
        mergedPayload = { ...serverItem };
        
        // Preserva campos específicos do cliente
        clientFields.forEach(field => {
          if (localItem.payload[field] !== undefined) {
            mergedPayload[field] = localItem.payload[field];
          }
        });
      } else {
        mergedPayload = localItem.payload;
      }

      return {
        ...localItem,
        payload: mergedPayload,
        updatedAt: Date.now(),
      };
    },
  }),

  /**
   * Estratégia baseada em versão
   */
  versionBased: (): ConflictResolutionStrategy => ({
    name: 'version-based',
    resolve: async (localItem: QueueItem, serverItem: any): Promise<QueueItem> => {
      const localVersion = localItem.payload.version || 0;
      const serverVersion = serverItem.version || 0;

      if (localVersion > serverVersion) {
        // Incrementa a versão local
        return {
          ...localItem,
          payload: {
            ...localItem.payload,
            version: localVersion + 1,
          },
          updatedAt: Date.now(),
        };
      } else {
        // Usa versão do servidor e incrementa
        return {
          ...localItem,
          payload: {
            ...serverItem,
            version: serverVersion + 1,
          },
          updatedAt: Date.now(),
        };
      }
    },
  }),

  /**
   * Estratégia personalizada que permite definir lógica customizada
   */
  custom: (resolveFn: (localItem: QueueItem, serverItem: any) => Promise<QueueItem>): ConflictResolutionStrategy => ({
    name: 'custom',
    resolve: resolveFn,
  }),

  /**
   * Estratégia que falha - força tratamento manual do conflito
   */
  manual: (): ConflictResolutionStrategy => ({
    name: 'manual',
    resolve: async (localItem: QueueItem, serverItem: any): Promise<QueueItem> => {
      throw new Error(`Conflito requer resolução manual para item ${localItem.id}`);
    },
  }),

  /**
   * Estratégia que mantém ambas as versões (cria duplicata)
   */
  keepBoth: (): ConflictResolutionStrategy => ({
    name: 'keep-both',
    resolve: async (localItem: QueueItem, serverItem: any): Promise<QueueItem> => {
      // Mantém o item local e marca que existe uma versão do servidor
      return {
        ...localItem,
        payload: {
          ...localItem.payload,
          conflictData: {
            hasServerVersion: true,
            serverVersion: serverItem,
            conflictResolvedAt: Date.now(),
          },
        },
        updatedAt: Date.now(),
      };
    },
  }),
};

/**
 * Utilitários para análise de conflitos
 */
export const ConflictUtils = {
  /**
   * Verifica se houve mudanças significativas entre as versões
   */
  hasSignificantChanges: (localItem: QueueItem, serverItem: any, ignoredFields: string[] = ['updatedAt', 'timestamp']): boolean => {
    if (typeof localItem.payload !== 'object' || typeof serverItem !== 'object') {
      return JSON.stringify(localItem.payload) !== JSON.stringify(serverItem);
    }

    const localCopy = { ...localItem.payload };
    const serverCopy = { ...serverItem };

    // Remove campos ignorados
    ignoredFields.forEach(field => {
      delete localCopy[field];
      delete serverCopy[field];
    });

    return JSON.stringify(localCopy) !== JSON.stringify(serverCopy);
  },

  /**
   * Identifica o tipo de conflito
   */
  identifyConflictType: (localItem: QueueItem, serverItem: any): 'version' | 'concurrent' | 'deleted' | 'field' => {
    if (!serverItem) {
      return 'deleted';
    }

    const localVersion = localItem.payload.version;
    const serverVersion = serverItem.version;

    if (localVersion && serverVersion && localVersion !== serverVersion) {
      return 'version';
    }

    const localTimestamp = localItem.updatedAt;
    const serverTimestamp = serverItem.updatedAt || serverItem.timestamp;

    if (Math.abs(localTimestamp - serverTimestamp) < 5000) { // 5 segundos
      return 'concurrent';
    }

    return 'field';
  },

  /**
   * Cria um relatório de diferenças entre as versões
   */
  createDiffReport: (localItem: QueueItem, serverItem: any): { 
    changedFields: string[]; 
    onlyInLocal: string[]; 
    onlyInServer: string[]; 
  } => {
    const report = {
      changedFields: [] as string[],
      onlyInLocal: [] as string[],
      onlyInServer: [] as string[],
    };

    if (typeof localItem.payload !== 'object' || typeof serverItem !== 'object') {
      return report;
    }

    const localKeys = Object.keys(localItem.payload);
    const serverKeys = Object.keys(serverItem);
    const allKeys = new Set([...localKeys, ...serverKeys]);

    allKeys.forEach(key => {
      const localValue = localItem.payload[key];
      const serverValue = serverItem[key];

      if (localValue === undefined) {
        report.onlyInServer.push(key);
      } else if (serverValue === undefined) {
        report.onlyInLocal.push(key);
      } else if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
        report.changedFields.push(key);
      }
    });

    return report;
  },
};
