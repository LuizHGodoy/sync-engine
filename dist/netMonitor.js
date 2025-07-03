"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetMonitor = void 0;
const netinfo_1 = __importDefault(require("@react-native-community/netinfo"));
/**
 * Monitor de conectividade de rede
 */
class NetMonitor {
    constructor() {
        this.isOnline = false;
        this.listeners = [];
        this.unsubscribe = null;
    }
    /**
     * Inicializa o monitor de rede
     */
    async initialize() {
        // Verifica status inicial
        const state = await netinfo_1.default.fetch();
        this.isOnline = state.isConnected ?? false;
        // Monitora mudanças de conectividade
        this.unsubscribe = netinfo_1.default.addEventListener((state) => {
            const wasOnline = this.isOnline;
            this.isOnline = state.isConnected ?? false;
            // Notifica listeners apenas se o status mudou
            if (wasOnline !== this.isOnline) {
                this.notifyListeners();
            }
        });
    }
    /**
     * Retorna o status atual da conexão
     */
    getConnectionStatus() {
        return this.isOnline;
    }
    /**
     * Adiciona um listener para mudanças de conectividade
     */
    addEventListener(listener) {
        this.listeners.push(listener);
    }
    /**
     * Remove um listener
     */
    removeEventListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    /**
     * Notifica todos os listeners sobre mudança de conectividade
     */
    notifyListeners() {
        const event = {
            type: 'connection_changed',
            timestamp: Date.now(),
            data: { isOnline: this.isOnline },
        };
        this.listeners.forEach(listener => {
            try {
                listener(event);
            }
            catch (error) {
                console.error('Erro ao notificar listener de conectividade:', error);
            }
        });
    }
    /**
     * Verifica se está conectado à internet
     */
    async checkConnection() {
        try {
            const state = await netinfo_1.default.fetch();
            const isConnected = state.isConnected ?? false;
            // Atualiza o status se mudou
            if (this.isOnline !== isConnected) {
                this.isOnline = isConnected;
                this.notifyListeners();
            }
            return isConnected;
        }
        catch (error) {
            console.error('Erro ao verificar conectividade:', error);
            return false;
        }
    }
    /**
     * Aguarda até que a conexão seja estabelecida
     */
    async waitForConnection(timeout = 30000) {
        if (this.isOnline) {
            return true;
        }
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                cleanup();
                resolve(false);
            }, timeout);
            const connectionListener = (event) => {
                if (event.type === 'connection_changed' && event.data?.isOnline) {
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
    /**
     * Obtém informações detalhadas da conexão
     */
    async getConnectionDetails() {
        try {
            const state = await netinfo_1.default.fetch();
            return {
                isConnected: state.isConnected ?? false,
                type: state.type,
                isInternetReachable: state.isInternetReachable,
            };
        }
        catch (error) {
            console.error('Erro ao obter detalhes da conexão:', error);
            return {
                isConnected: false,
                type: 'unknown',
                isInternetReachable: null,
            };
        }
    }
    /**
     * Finaliza o monitor de rede
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.listeners = [];
    }
}
exports.NetMonitor = NetMonitor;
//# sourceMappingURL=netMonitor.js.map