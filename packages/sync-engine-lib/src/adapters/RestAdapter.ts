import {
  FetchOptions,
  ServerEntity,
  SyncAdapter,
  SyncResult,
} from "./SyncAdapter";

export interface RestAdapterConfig {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
  auth?: {
    type: "bearer" | "apikey" | "basic";
    token?: string;
    apiKey?: string;
    username?: string;
    password?: string;
  };
}

export class RestAdapter extends SyncAdapter {
  private config: RestAdapterConfig;

  constructor(config: RestAdapterConfig) {
    super();
    this.config = {
      timeout: 10000,
      ...config,
    };
  }

  async create(table: string, data: any): Promise<SyncResult> {
    try {
      const response = await this.request("POST", `/${table}`, data);
      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(table: string, id: string, data: any): Promise<SyncResult> {
    try {
      const response = await this.request("PUT", `/${table}/${id}`, data);
      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(table: string, id: string): Promise<SyncResult> {
    try {
      await this.request("DELETE", `/${table}/${id}`);
      return {
        success: true,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async fetchUpdates(
    table: string,
    options?: FetchOptions
  ): Promise<{
    entities: ServerEntity[];
    hasMore: boolean;
    nextOffset?: number;
  }> {
    const params = new URLSearchParams();

    if (options?.since) {
      params.append("updated_since", options.since.toISOString());
    }
    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }
    if (options?.offset) {
      params.append("offset", options.offset.toString());
    }

    const url = `/${table}${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await this.request("GET", url);

    return {
      entities: Array.isArray(response) ? response : response.data || [],
      hasMore: response.hasMore || false,
      nextOffset: response.nextOffset,
    };
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.request("GET", "/health");
      return true;
    } catch {
      return false;
    }
  }

  private async request(
    method: string,
    path: string,
    body?: any
  ): Promise<any> {
    const url = `${this.config.baseURL.replace(/\/$/, "")}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.config.headers,
    };

    if (this.config.auth) {
      switch (this.config.auth.type) {
        case "bearer":
          headers["Authorization"] = `Bearer ${this.config.auth.token}`;
          break;
        case "apikey":
          headers["X-API-Key"] = this.config.auth.apiKey!;
          break;
        case "basic":
          const credentials = btoa(
            `${this.config.auth.username}:${this.config.auth.password}`
          );
          headers["Authorization"] = `Basic ${credentials}`;
          break;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }
}
