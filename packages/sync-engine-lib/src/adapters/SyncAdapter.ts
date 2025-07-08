export interface ServerEntity {
  id: string;
  [key: string]: any;
}

export interface SyncResult {
  success: boolean;
  data?: ServerEntity;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface FetchOptions {
  since?: Date;
  limit?: number;
  offset?: number;
}

export abstract class SyncAdapter {
  abstract create(table: string, data: any): Promise<SyncResult>;
  abstract update(table: string, id: string, data: any): Promise<SyncResult>;
  abstract delete(table: string, id: string): Promise<SyncResult>;
  abstract fetchUpdates(
    table: string,
    options?: FetchOptions
  ): Promise<{
    entities: ServerEntity[];
    hasMore: boolean;
    nextOffset?: number;
  }>;

  async validateConnection(): Promise<boolean> {
    try {
      return true;
    } catch {
      return false;
    }
  }

  protected handleError(error: any): SyncResult {
    const isNetworkError =
      error.name === "NetworkError" ||
      error.code === "NETWORK_ERROR" ||
      error.message?.includes("fetch");

    const isServerError = error.status >= 500 && error.status < 600;
    const isRateLimited = error.status === 429;

    return {
      success: false,
      error: {
        code: error.code || error.status?.toString() || "UNKNOWN_ERROR",
        message: error.message || "Unknown error occurred",
        retryable: isNetworkError || isServerError || isRateLimited,
      },
    };
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * delay * 0.1;
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }

    throw lastError!;
  }
}
