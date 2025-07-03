import { QueueItem, ConflictResolutionStrategy } from './types';
/**
 * Resolvedor de conflitos com estratégias pluggáveis
 */
export declare class ConflictResolver {
    private strategy;
    constructor(strategy: ConflictResolutionStrategy);
    /**
     * Resolve um conflito usando a estratégia configurada
     */
    resolve(localItem: QueueItem, serverItem: any): Promise<QueueItem>;
    /**
     * Muda a estratégia de resolução
     */
    setStrategy(strategy: ConflictResolutionStrategy): void;
    /**
     * Obtém a estratégia atual
     */
    getStrategy(): ConflictResolutionStrategy;
}
/**
 * Estratégias predefinidas de resolução de conflitos
 */
export declare const ConflictStrategies: {
    /**
     * Cliente sempre vence - mantém a versão local
     */
    clientWins: () => ConflictResolutionStrategy;
    /**
     * Servidor sempre vence - usa a versão do servidor
     */
    serverWins: () => ConflictResolutionStrategy;
    /**
     * Timestamp vence - usa a versão mais recente
     */
    timestampWins: () => ConflictResolutionStrategy;
    /**
     * Merge simples - combina propriedades (shallow merge)
     */
    merge: () => ConflictResolutionStrategy;
    /**
     * Merge inteligente - preserva campos específicos do cliente
     */
    smartMerge: (clientFields?: string[]) => ConflictResolutionStrategy;
    /**
     * Estratégia baseada em versão
     */
    versionBased: () => ConflictResolutionStrategy;
    /**
     * Estratégia personalizada que permite definir lógica customizada
     */
    custom: (resolveFn: (localItem: QueueItem, serverItem: any) => Promise<QueueItem>) => ConflictResolutionStrategy;
    /**
     * Estratégia que falha - força tratamento manual do conflito
     */
    manual: () => ConflictResolutionStrategy;
    /**
     * Estratégia que mantém ambas as versões (cria duplicata)
     */
    keepBoth: () => ConflictResolutionStrategy;
};
/**
 * Utilitários para análise de conflitos
 */
export declare const ConflictUtils: {
    /**
     * Verifica se houve mudanças significativas entre as versões
     */
    hasSignificantChanges: (localItem: QueueItem, serverItem: any, ignoredFields?: string[]) => boolean;
    /**
     * Identifica o tipo de conflito
     */
    identifyConflictType: (localItem: QueueItem, serverItem: any) => "version" | "concurrent" | "deleted" | "field";
    /**
     * Cria um relatório de diferenças entre as versões
     */
    createDiffReport: (localItem: QueueItem, serverItem: any) => {
        changedFields: string[];
        onlyInLocal: string[];
        onlyInServer: string[];
    };
};
//# sourceMappingURL=conflictResolver.d.ts.map