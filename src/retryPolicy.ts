import { BackoffConfig } from './types';

/**
 * Gerenciador de política de retry com backoff exponencial
 */
export class RetryPolicy {
  private config: BackoffConfig;

  constructor(config: BackoffConfig) {
    this.config = config;
  }

  /**
   * Calcula o delay para a próxima tentativa
   */
  calculateDelay(attempt: number): number {
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
  shouldRetry(currentAttempt: number): boolean {
    return currentAttempt < this.config.maxRetries;
  }

  /**
   * Aguarda o tempo de delay calculado
   */
  async wait(attempt: number): Promise<void> {
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
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Aguarda o delay se não for a primeira tentativa
        if (attempt > 1) {
          await this.wait(attempt - 1);
        }

        return await operation();
      } catch (error) {
        lastError = error as Error;
        
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
    throw lastError!;
  }

  /**
   * Cria uma nova instância com configuração atualizada
   */
  withConfig(newConfig: Partial<BackoffConfig>): RetryPolicy {
    return new RetryPolicy({
      ...this.config,
      ...newConfig,
    });
  }

  /**
   * Obtém a configuração atual
   */
  getConfig(): BackoffConfig {
    return { ...this.config };
  }

  /**
   * Calcula o tempo total máximo que pode levar para esgotar todas as tentativas
   */
  calculateMaxTotalTime(): number {
    let totalTime = 0;
    
    for (let attempt = 1; attempt < this.config.maxRetries; attempt++) {
      totalTime += this.calculateDelay(attempt);
    }
    
    return totalTime;
  }

  /**
   * Gera um jitter (variação aleatória) para evitar thundering herd
   */
  calculateDelayWithJitter(attempt: number, jitterFactor: number = 0.1): number {
    const baseDelay = this.calculateDelay(attempt);
    const maxJitter = baseDelay * jitterFactor;
    const jitter = Math.random() * maxJitter * 2 - maxJitter; // -maxJitter to +maxJitter
    
    return Math.max(0, baseDelay + jitter);
  }

  /**
   * Aguarda com jitter aplicado
   */
  async waitWithJitter(attempt: number, jitterFactor: number = 0.1): Promise<void> {
    const delay = this.calculateDelayWithJitter(attempt, jitterFactor);
    
    if (delay <= 0) {
      return;
    }

    return new Promise(resolve => {
      setTimeout(resolve, delay);
    });
  }
}

/**
 * Configurações predefinidas de retry
 */
export const RetryPolicies = {
  /**
   * Política conservadora - para operações críticas
   */
  conservative: (): RetryPolicy => new RetryPolicy({
    initialDelay: 1000, // 1 segundo
    multiplier: 2,
    maxDelay: 30000, // 30 segundos
    maxRetries: 5,
  }),

  /**
   * Política agressiva - para operações menos críticas
   */
  aggressive: (): RetryPolicy => new RetryPolicy({
    initialDelay: 500, // 0.5 segundos
    multiplier: 1.5,
    maxDelay: 10000, // 10 segundos
    maxRetries: 3,
  }),

  /**
   * Política rápida - para operações que precisam falhar rápido
   */
  fast: (): RetryPolicy => new RetryPolicy({
    initialDelay: 100, // 0.1 segundos
    multiplier: 2,
    maxDelay: 2000, // 2 segundos
    maxRetries: 2,
  }),

  /**
   * Política personalizada com valores padrão sensatos
   */
  default: (): RetryPolicy => new RetryPolicy({
    initialDelay: 1000, // 1 segundo
    multiplier: 2,
    maxDelay: 15000, // 15 segundos
    maxRetries: 3,
  }),
};
