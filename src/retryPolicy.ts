import { BackoffConfig } from "./types";

export class RetryPolicy {
  private config: BackoffConfig;

  constructor(config: BackoffConfig) {
    this.config = config;
  }

  calculateDelay(attempt: number): number {
    if (attempt <= 0) {
      return 0;
    }

    const delay =
      this.config.initialDelay * Math.pow(this.config.multiplier, attempt - 1);

    return Math.min(delay, this.config.maxDelay);
  }

  shouldRetry(currentAttempt: number): boolean {
    return currentAttempt < this.config.maxRetries;
  }

  async wait(attempt: number): Promise<void> {
    const delay = this.calculateDelay(attempt);

    if (delay <= 0) {
      return;
    }

    return new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          await this.wait(attempt - 1);
        }

        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (onRetry) {
          onRetry(attempt, lastError);
        }
        if (this.shouldRetry(attempt)) {
          continue;
        }

        throw lastError;
      }
    }
    throw lastError!;
  }

  withConfig(newConfig: Partial<BackoffConfig>): RetryPolicy {
    return new RetryPolicy({
      ...this.config,
      ...newConfig,
    });
  }

  getConfig(): BackoffConfig {
    return { ...this.config };
  }

  calculateMaxTotalTime(): number {
    let totalTime = 0;

    for (let attempt = 1; attempt < this.config.maxRetries; attempt++) {
      totalTime += this.calculateDelay(attempt);
    }

    return totalTime;
  }

  calculateDelayWithJitter(
    attempt: number,
    jitterFactor: number = 0.1
  ): number {
    const baseDelay = this.calculateDelay(attempt);
    const maxJitter = baseDelay * jitterFactor;
    const jitter = Math.random() * maxJitter * 2 - maxJitter;

    return Math.max(0, baseDelay + jitter);
  }

  async waitWithJitter(
    attempt: number,
    jitterFactor: number = 0.1
  ): Promise<void> {
    const delay = this.calculateDelayWithJitter(attempt, jitterFactor);

    if (delay <= 0) {
      return;
    }

    return new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }
}

export const RetryPolicies = {
  conservative: (): RetryPolicy =>
    new RetryPolicy({
      initialDelay: 1000,
      multiplier: 2,
      maxDelay: 30000,
      maxRetries: 5,
    }),

  aggressive: (): RetryPolicy =>
    new RetryPolicy({
      initialDelay: 500,
      multiplier: 1.5,
      maxDelay: 10000,
      maxRetries: 3,
    }),

  fast: (): RetryPolicy =>
    new RetryPolicy({
      initialDelay: 100,
      multiplier: 2,
      maxDelay: 2000,
      maxRetries: 2,
    }),

  default: (): RetryPolicy =>
    new RetryPolicy({
      initialDelay: 1000,
      multiplier: 2,
      maxDelay: 15000,
      maxRetries: 3,
    }),
};
