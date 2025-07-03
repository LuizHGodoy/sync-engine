import NetInfo from "@react-native-community/netinfo";
import { SyncEventListener } from "./types";

export class NetMonitor {
  private isOnline: boolean = false;
  private listeners: SyncEventListener[] = [];
  private unsubscribe: (() => void) | null = null;

  async initialize(): Promise<void> {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;

    this.unsubscribe = NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOnline !== this.isOnline) {
        this.notifyListeners();
      }
    });
  }

  getConnectionStatus(): boolean {
    return this.isOnline;
  }

  addEventListener(listener: SyncEventListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: SyncEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(): void {
    const event = {
      type: "connection_changed" as const,
      timestamp: Date.now(),
      data: { isOnline: this.isOnline },
    };

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Erro ao notificar listener de conectividade:", error);
      }
    });
  }

  async checkConnection(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      const isConnected = state.isConnected ?? false;

      if (this.isOnline !== isConnected) {
        this.isOnline = isConnected;
        this.notifyListeners();
      }

      return isConnected;
    } catch (error) {
      console.error("Erro ao verificar conectividade:", error);
      return false;
    }
  }

  async waitForConnection(timeout: number = 30000): Promise<boolean> {
    if (this.isOnline) {
      return true;
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeout);

      const connectionListener: SyncEventListener = (event) => {
        if (event.type === "connection_changed" && event.data?.isOnline) {
          cleanup();
          resolve(true);
        }
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.removeEventListener(connectionListener);
      };

      this.addEventListener(connectionListener);
    });
  }

  async getConnectionDetails(): Promise<{
    isConnected: boolean;
    type: string;
    isInternetReachable: boolean | null;
  }> {
    try {
      const state = await NetInfo.fetch();
      return {
        isConnected: state.isConnected ?? false,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      };
    } catch (error) {
      console.error("Erro ao obter detalhes da conexão:", error);
      return {
        isConnected: false,
        type: "unknown",
        isInternetReachable: null,
      };
    }
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners = [];
  }
}
