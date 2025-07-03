"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictUtils = exports.ConflictStrategies = exports.ConflictResolver = void 0;
/**
 * Resolvedor de conflitos com estratégias pluggáveis
 */
class ConflictResolver {
    constructor(strategy) {
        this.strategy = strategy;
    }
    /**
     * Resolve um conflito usando a estratégia configurada
     */
    async resolve(localItem, serverItem) {
        try {
            return await this.strategy.resolve(localItem, serverItem);
        }
        catch (error) {
            throw new Error(`Erro ao resolver conflito: ${error}`);
        }
    }
    /**
     * Muda a estratégia de resolução
     */
    setStrategy(strategy) {
        this.strategy = strategy;
    }
    /**
     * Obtém a estratégia atual
     */
    getStrategy() {
        return this.strategy;
    }
}
exports.ConflictResolver = ConflictResolver;
/**
 * Estratégias predefinidas de resolução de conflitos
 */
exports.ConflictStrategies = {
    /**
     * Cliente sempre vence - mantém a versão local
     */
    clientWins: () => ({
        name: 'client-wins',
        resolve: async (localItem, _serverItem) => {
            return {
                ...localItem,
                updatedAt: Date.now(),
            };
        },
    }),
    /**
     * Servidor sempre vence - usa a versão do servidor
     */
    serverWins: () => ({
        name: 'server-wins',
        resolve: async (localItem, serverItem) => {
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
    timestampWins: () => ({
        name: 'timestamp-wins',
        resolve: async (localItem, serverItem) => {
            const serverTimestamp = serverItem.updatedAt || serverItem.timestamp || 0;
            const localTimestamp = localItem.updatedAt;
            if (localTimestamp >= serverTimestamp) {
                return {
                    ...localItem,
                    updatedAt: Date.now(),
                };
            }
            else {
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
    merge: () => ({
        name: 'merge',
        resolve: async (localItem, serverItem) => {
            let mergedPayload;
            if (typeof localItem.payload === 'object' && typeof serverItem === 'object') {
                mergedPayload = {
                    ...serverItem,
                    ...localItem.payload,
                };
            }
            else {
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
    smartMerge: (clientFields = ['id', 'createdAt']) => ({
        name: 'smart-merge',
        resolve: async (localItem, serverItem) => {
            let mergedPayload;
            if (typeof localItem.payload === 'object' && typeof serverItem === 'object') {
                mergedPayload = { ...serverItem };
                // Preserva campos específicos do cliente
                clientFields.forEach(field => {
                    if (localItem.payload[field] !== undefined) {
                        mergedPayload[field] = localItem.payload[field];
                    }
                });
            }
            else {
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
    versionBased: () => ({
        name: 'version-based',
        resolve: async (localItem, serverItem) => {
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
            }
            else {
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
    custom: (resolveFn) => ({
        name: 'custom',
        resolve: resolveFn,
    }),
    /**
     * Estratégia que falha - força tratamento manual do conflito
     */
    manual: () => ({
        name: 'manual',
        resolve: async (localItem, serverItem) => {
            throw new Error(`Conflito requer resolução manual para item ${localItem.id}`);
        },
    }),
    /**
     * Estratégia que mantém ambas as versões (cria duplicata)
     */
    keepBoth: () => ({
        name: 'keep-both',
        resolve: async (localItem, serverItem) => {
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
exports.ConflictUtils = {
    /**
     * Verifica se houve mudanças significativas entre as versões
     */
    hasSignificantChanges: (localItem, serverItem, ignoredFields = ['updatedAt', 'timestamp']) => {
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
    identifyConflictType: (localItem, serverItem) => {
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
    createDiffReport: (localItem, serverItem) => {
        const report = {
            changedFields: [],
            onlyInLocal: [],
            onlyInServer: [],
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
            }
            else if (serverValue === undefined) {
                report.onlyInLocal.push(key);
            }
            else if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
                report.changedFields.push(key);
            }
        });
        return report;
    },
};
//# sourceMappingURL=conflictResolver.js.map