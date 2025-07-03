"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryPolicies = exports.RetryPolicy = void 0;
/**
 * Gerenciador de política de retry com backoff exponencial
 */
class RetryPolicy {
    constructor(config) {
        this.config = config;
    }
    /**
     * Calcula o delay para a próxima tentativa
     */
    calculateDelay(attempt) {
        if (attempt <= 0) {
            return 0;
        }
        // Backoff exponencial: delay = initialDelay * (multiplier ^ (attempt - 1))
        const delay = this.config.initialDelay * Math.pow(this.config.multiplier, attempt - 1);
        // Limita ao delay máximo
        return Math.min(delay, this.config.maxDelay);
    }
    /**
     * Verifica se deve tentar novamente
     */
    shouldRetry(currentAttempt) {
        return currentAttempt < this.config.maxRetries;
    }
    /**
     * Aguarda o tempo de delay calculado
     */
    async wait(attempt) {
        const delay = this.calculateDelay(attempt);
        if (delay <= 0) {
            return;
        }
        return new Promise(resolve => {
            setTimeout(resolve, delay);
        });
    }
    /**
     * Executa uma operação com retry automático
     */
    async executeWithRetry(operation, onRetry) {
        let lastError;
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                // Aguarda o delay se não for a primeira tentativa
                if (attempt > 1) {
                    await this.wait(attempt - 1);
                }
                return await operation();
            }
            catch (error) {
                lastError = error;
                // Chama callback de retry se fornecido
                if (onRetry) {
                    onRetry(attempt, lastError);
                }
                // Se ainda pode tentar novamente, continua
                if (this.shouldRetry(attempt)) {
                    continue;
                }
                // Esgotou as tentativas, lança o último erro
                throw lastError;
            }
        }
        // Nunca deveria chegar aqui, mas por segurança
        throw lastError;
    }
    /**
     * Cria uma nova instância com configuração atualizada
     */
    withConfig(newConfig) {
        return new RetryPolicy({
            ...this.config,
            ...newConfig,
        });
    }
    /**
     * Obtém a configuração atual
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Calcula o tempo total máximo que pode levar para esgotar todas as tentativas
     */
    calculateMaxTotalTime() {
        let totalTime = 0;
        for (let attempt = 1; attempt < this.config.maxRetries; attempt++) {
            totalTime += this.calculateDelay(attempt);
        }
        return totalTime;
    }
    /**
     * Gera um jitter (variação aleatória) para evitar thundering herd
     */
    calculateDelayWithJitter(attempt, jitterFactor = 0.1) {
        const baseDelay = this.calculateDelay(attempt);
        const maxJitter = baseDelay * jitterFactor;
        const jitter = Math.random() * maxJitter * 2 - maxJitter; // -maxJitter to +maxJitter
        return Math.max(0, baseDelay + jitter);
    }
    /**
     * Aguarda com jitter aplicado
     */
    async waitWithJitter(attempt, jitterFactor = 0.1) {
        const delay = this.calculateDelayWithJitter(attempt, jitterFactor);
        if (delay <= 0) {
            return;
        }
        return new Promise(resolve => {
            setTimeout(resolve, delay);
        });
    }
}
exports.RetryPolicy = RetryPolicy;
/**
 * Configurações predefinidas de retry
 */
exports.RetryPolicies = {
    /**
     * Política conservadora - para operações críticas
     */
    conservative: () => new RetryPolicy({
        initialDelay: 1000, // 1 segundo
        multiplier: 2,
        maxDelay: 30000, // 30 segundos
        maxRetries: 5,
    }),
    /**
     * Política agressiva - para operações menos críticas
     */
    aggressive: () => new RetryPolicy({
        initialDelay: 500, // 0.5 segundos
        multiplier: 1.5,
        maxDelay: 10000, // 10 segundos
        maxRetries: 3,
    }),
    /**
     * Política rápida - para operações que precisam falhar rápido
     */
    fast: () => new RetryPolicy({
        initialDelay: 100, // 0.1 segundos
        multiplier: 2,
        maxDelay: 2000, // 2 segundos
        maxRetries: 2,
    }),
    /**
     * Política personalizada com valores padrão sensatos
     */
    default: () => new RetryPolicy({
        initialDelay: 1000, // 1 segundo
        multiplier: 2,
        maxDelay: 15000, // 15 segundos
        maxRetries: 3,
    }),
};
//# sourceMappingURL=retryPolicy.js.map