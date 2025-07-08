import {
  FetchOptions,
  OfflineFirstEngine,
  ServerEntity,
  SyncAdapter,
  SyncResult,
} from "sync-engine-lib";

class DemoRestAdapter extends SyncAdapter {
  private baseURL: string;
  private delay: number;

  constructor(baseURL: string, delay = 500) {
    super();
    this.baseURL = baseURL;
    this.delay = delay;
  }

  private async makeRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<SyncResult> {
    try {
      await new Promise((resolve) => setTimeout(resolve, this.delay));

      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: `HTTP ${response.status}: ${response.statusText}`,
            retryable: response.status >= 500 || response.status === 429,
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data as ServerEntity,
      };
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError && error.message.includes("fetch");

      return {
        success: false,
        error: {
          code: isNetworkError ? "NETWORK_ERROR" : "REQUEST_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
          retryable: isNetworkError,
        },
      };
    }
  }

  async create(table: string, data: any): Promise<SyncResult> {
    console.log(`[Demo API] POST /${table}`, data);

    return this.syncWithServer([
      {
        ...data,
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: Date.now(),
        type: table,
        operation: "CREATE",
      },
    ]);
  }

  async update(table: string, id: string, data: any): Promise<SyncResult> {
    console.log(`[Demo API] PUT /${table}/${id}`, data);

    return this.syncWithServer([
      {
        ...data,
        id,
        updatedAt: Date.now(),
        type: table,
        operation: "UPDATE",
      },
    ]);
  }

  async delete(table: string, id: string): Promise<SyncResult> {
    console.log(`[Demo API] DELETE /${table}/${id}`);

    return this.syncWithServer([
      {
        id,
        deleted: true,
        updatedAt: Date.now(),
        type: table,
        operation: "DELETE",
      },
    ]);
  }

  private async syncWithServer(data: any[]): Promise<SyncResult> {
    const result = await this.makeRequest(`${this.baseURL}/sync`, {
      method: "POST",
      body: JSON.stringify({
        data,
        lastSync: null,
      }),
    });

    if (result.success && result.data) {
      const syncResult = result.data as any;
      if (syncResult.success && syncResult.data && syncResult.data.length > 0) {
        return {
          success: true,
          data: syncResult.data[0] as ServerEntity,
        };
      }
    }

    return result;
  }

  async fetchUpdates(
    table: string,
    options: FetchOptions = {}
  ): Promise<{
    entities: ServerEntity[];
    hasMore: boolean;
    nextOffset?: number;
  }> {
    console.log(`[Demo API] GET /${table}`, options);

    try {
      const result = await this.makeRequest(`${this.baseURL}/todos`);

      if (result.success && Array.isArray(result.data)) {
        return {
          entities: result.data as ServerEntity[],
          hasMore: false,
          nextOffset: undefined,
        };
      } else {
        throw new Error(result.error?.message || "Failed to fetch updates");
      }
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to fetch updates"
      );
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      const result = await this.makeRequest(`${this.baseURL}/todos`);
      return result.success;
    } catch {
      return false;
    }
  }
}

export const createOfflineEngine = () => {
  const adapter = new DemoRestAdapter("http://localhost:4000", 500);

  return new OfflineFirstEngine({
    adapter,
    entities: {
      todos: {
        schema: {
          text: "string",
          completed: "boolean",
          priority: "string",
          dueDate: "date",
          tags: "json",
        },
      },
      categories: {
        schema: {
          name: "string",
          color: "string",
          description: "string",
        },
      },
    },
    sync: {
      batchSize: 10,
      syncInterval: 15000,
      maxRetries: 3,
      retryDelay: 2000,
    },
  });
};
