import { BackoffConfig } from './types';
/**
 * Gerenciador de política de retry com backoff exponencial
 */
export declare class RetryPolicy {
    private config;
    constructor(config: BackoffConfig);
    /**
     * Calcula o delay para a próxima tentativa
     */
    calculateDelay(attempt: number): number;
    /**
     * Verifica se deve tentar novamente
     */
    shouldRetry(currentAttempt: number): boolean;
    /**
     * Aguarda o tempo de delay calculado
     */
    wait(attempt: number): Promise<void>;
    /**
     * Executa uma operação com retry automático
     */
    executeWithRetry<T>(operation: () => Promise<T>, onRetry?: (attempt: number, error: Error) => void): Promise<T>;
    /**
     * Cria uma nova instância com configuração atualizada
     */
    withConfig(newConfig: Partial<BackoffConfig>): RetryPolicy;
    /**
     * Obtém a configuração atual
     */
    getConfig(): BackoffConfig;
    /**
     * Calcula o tempo total máximo que pode levar para esgotar todas as tentativas
     */
    calculateMaxTotalTime(): number;
    /**
     * Gera um jitter (variação aleatória) para evitar thundering herd
     */
    calculateDelayWithJitter(attempt: number, jitterFactor?: number): number;
    /**
     * Aguarda com jitter aplicado
     */
    waitWithJitter(attempt: number, jitterFactor?: number): Promise<void>;
}
/**
 * Configurações predefinidas de retry
 */
export declare const RetryPolicies: {
    /**
     * Política conservadora - para operações críticas
     */
    conservative: () => RetryPolicy;
    /**
     * Política agressiva - para operações menos críticas
     */
    aggressive: () => RetryPolicy;
    /**
     * Política rápida - para operações que precisam falhar rápido
     */
    fast: () => RetryPolicy;
    /**
     * Política personalizada com valores padrão sensatos
     */
    default: () => RetryPolicy;
};
//# sourceMappingURL=retryPolicy.d.ts.map