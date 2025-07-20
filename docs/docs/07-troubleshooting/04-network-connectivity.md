# Problemas de Conectividade de Rede

Aplicações offline-first dependem de gerenciamento robusto de conectividade de rede. Este guia aborda problemas comuns de conectividade e suas soluções.

## 🌐 Tipos de Problemas de Conectividade

### 1. **Detecção de Conectividade Imprecisa**
- App reporta online quando está offline
- App reporta offline quando está online
- Mudanças de estado não são detectadas

### 2. **Conectividade Intermitente**
- Rede instável com quedas frequentes
- Latência alta causando timeouts
- Captive portals (Wi-Fi com autenticação)

### 3. **Problemas de Proxy/Firewall**
- Requests bloqueados por proxy corporativo
- Headers customizados removidos
- HTTPS/TLS issues

### 4. **Limitações de Banda**
- Conexão muito lenta para sync
- Limits de dados móveis
- Throttling do provedor

## 🔍 Diagnóstico de Conectividade

### 1. Network Connectivity Debugger

```typescript
// utils/networkDebugger.ts
export class NetworkConnectivityDebugger {
  private netInfo: any;
  private connectionHistory: Array<{
    timestamp: number;
    isConnected: boolean;
    connectionType: string;
    details: any;
  }> = [];

  constructor() {
    this.setupNetInfoMonitoring();
  }

  private setupNetInfoMonitoring() {
    // Monitor NetInfo changes
    this.netInfo = require('@react-native-community/netinfo');
    
    this.netInfo.addEventListener((state: any) => {
      this.recordConnectionState(state);
      this.analyzeConnectionChange(state);
    });
  }

  private recordConnectionState(state: any) {
    this.connectionHistory.push({
      timestamp: Date.now(),
      isConnected: state.isConnected,
      connectionType: state.type,
      details: {
        isInternetReachable: state.isInternetReachable,
        strength: state.details?.strength,
        cellularGeneration: state.details?.cellularGeneration,
        ssid: state.details?.ssid
      }
    });

    // Manter apenas últimas 100 entradas
    if (this.connectionHistory.length > 100) {
      this.connectionHistory.shift();
    }
  }

  private analyzeConnectionChange(state: any) {
    const previous = this.connectionHistory[this.connectionHistory.length - 2];
    
    if (!previous) return;

    const timeSinceLastChange = Date.now() - previous.timestamp;
    
    // Detectar mudanças rápidas (possível instabilidade)
    if (timeSinceLastChange < 5000 && previous.isConnected !== state.isConnected) {
      console.warn('🔄 Rapid connection change detected', {
        from: previous,
        to: state,
        timeDiff: timeSinceLastChange
      });
    }

    // Detectar conexão sem internet
    if (state.isConnected && !state.isInternetReachable) {
      console.warn('📡 Connected but no internet access', state);
      this.performConnectivityTest();
    }

    // Log mudanças significativas
    if (previous.connectionType !== state.type) {
      console.log('🔀 Connection type changed', {
        from: previous.connectionType,
        to: state.type
      });
    }
  }

  async performConnectivityTest(): Promise<{
    canReachServer: boolean;
    serverResponseTime?: number;
    canReachInternet: boolean;
    internetResponseTime?: number;
    dnsResolution: boolean;
  }> {
    const results = {
      canReachServer: false,
      serverResponseTime: undefined as number | undefined,
      canReachInternet: false,
      internetResponseTime: undefined as number | undefined,
      dnsResolution: false
    };

    try {
      // Test DNS resolution
      results.dnsResolution = await this.testDNSResolution();

      // Test internet connectivity
      const internetTest = await this.testInternetConnectivity();
      results.canReachInternet = internetTest.success;
      results.internetResponseTime = internetTest.responseTime;

      // Test server connectivity
      const serverTest = await this.testServerConnectivity();
      results.canReachServer = serverTest.success;
      results.serverResponseTime = serverTest.responseTime;

      console.log('🔍 Connectivity test results:', results);
      
    } catch (error) {
      console.error('❌ Connectivity test failed:', error);
    }

    return results;
  }

  private async testDNSResolution(): Promise<boolean> {
    try {
      // Tentar resolver DNS
      const response = await fetch('https://dns.google/resolve?name=google.com&type=A', {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async testInternetConnectivity(): Promise<{ success: boolean; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://clients3.google.com/generate_204', {
        method: 'GET',
        timeout: 10000
      });
      
      const responseTime = Date.now() - startTime;
      return { 
        success: response.status === 204, 
        responseTime 
      };
    } catch {
      return { success: false };
    }
  }

  private async testServerConnectivity(): Promise<{ success: boolean; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      const serverUrl = this.getServerUrl();
      const response = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        timeout: 15000
      });
      
      const responseTime = Date.now() - startTime;
      return { 
        success: response.ok, 
        responseTime 
      };
    } catch {
      return { success: false };
    }
  }

  getConnectionAnalysis(): {
    stability: 'stable' | 'unstable' | 'very_unstable';
    avgConnectionDuration: number;
    connectionChanges: number;
    mostCommonType: string;
  } {
    if (this.connectionHistory.length < 2) {
      return {
        stability: 'stable',
        avgConnectionDuration: 0,
        connectionChanges: 0,
        mostCommonType: 'unknown'
      };
    }

    // Calcular mudanças de conexão
    let connectionChanges = 0;
    const connectionDurations: number[] = [];
    
    for (let i = 1; i < this.connectionHistory.length; i++) {
      const prev = this.connectionHistory[i - 1];
      const curr = this.connectionHistory[i];
      
      if (prev.isConnected !== curr.isConnected) {
        connectionChanges++;
        connectionDurations.push(curr.timestamp - prev.timestamp);
      }
    }

    // Calcular duração média
    const avgConnectionDuration = connectionDurations.length > 0
      ? connectionDurations.reduce((a, b) => a + b, 0) / connectionDurations.length
      : 0;

    // Determinar estabilidade
    let stability: 'stable' | 'unstable' | 'very_unstable';
    if (connectionChanges === 0) {
      stability = 'stable';
    } else if (connectionChanges < 5) {
      stability = 'unstable';
    } else {
      stability = 'very_unstable';
    }

    // Tipo mais comum
    const typeCounts = this.connectionHistory.reduce((acc, entry) => {
      acc[entry.connectionType] = (acc[entry.connectionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostCommonType = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';

    return {
      stability,
      avgConnectionDuration,
      connectionChanges,
      mostCommonType
    };
  }

  private getServerUrl(): string {
    // Obter URL do servidor (implementação específica)
    return 'https://api.example.com';
  }

  exportDiagnostics(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      connectionHistory: this.connectionHistory,
      analysis: this.getConnectionAnalysis()
    }, null, 2);
  }
}
```

### 2. Advanced Network Monitor

```typescript
// utils/advancedNetworkMonitor.ts
export class AdvancedNetworkMonitor {
  private connectionQuality: 'excellent' | 'good' | 'poor' | 'very_poor' = 'good';
  private latencyHistory: number[] = [];
  private bandwidthHistory: Array<{ timestamp: number; bytesPerSecond: number }> = [];
  private failedRequests: Array<{ timestamp: number; error: string; url: string }> = [];

  constructor() {
    this.startLatencyMonitoring();
    this.startBandwidthMonitoring();
  }

  private startLatencyMonitoring() {
    setInterval(async () => {
      const latency = await this.measureLatency();
      if (latency !== null) {
        this.latencyHistory.push(latency);
        
        // Manter apenas últimas 20 medições
        if (this.latencyHistory.length > 20) {
          this.latencyHistory.shift();
        }
        
        this.updateConnectionQuality();
      }
    }, 30000); // A cada 30 segundos
  }

  private async measureLatency(): Promise<number | null> {
    try {
      const startTime = Date.now();
      
      await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        timeout: 10000
      });
      
      return Date.now() - startTime;
    } catch {
      return null;
    }
  }

  private startBandwidthMonitoring() {
    setInterval(async () => {
      const bandwidth = await this.estimateBandwidth();
      if (bandwidth !== null) {
        this.bandwidthHistory.push({
          timestamp: Date.now(),
          bytesPerSecond: bandwidth
        });
        
        // Manter apenas últimas 10 medições
        if (this.bandwidthHistory.length > 10) {
          this.bandwidthHistory.shift();
        }
      }
    }, 60000); // A cada minuto
  }

  private async estimateBandwidth(): Promise<number | null> {
    try {
      const testSize = 50 * 1024; // 50KB test
      const startTime = Date.now();
      
      const response = await fetch(`https://httpbin.org/bytes/${testSize}`, {
        timeout: 30000
      });
      
      if (!response.ok) return null;
      
      const data = await response.arrayBuffer();
      const duration = (Date.now() - startTime) / 1000; // segundos
      
      return data.byteLength / duration; // bytes por segundo
    } catch {
      return null;
    }
  }

  private updateConnectionQuality() {
    if (this.latencyHistory.length === 0) return;

    const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;

    if (avgLatency < 100) {
      this.connectionQuality = 'excellent';
    } else if (avgLatency < 300) {
      this.connectionQuality = 'good';
    } else if (avgLatency < 1000) {
      this.connectionQuality = 'poor';
    } else {
      this.connectionQuality = 'very_poor';
    }
  }

  recordFailedRequest(url: string, error: string) {
    this.failedRequests.push({
      timestamp: Date.now(),
      error,
      url
    });

    // Manter apenas últimas 50 falhas
    if (this.failedRequests.length > 50) {
      this.failedRequests.shift();
    }

    // Analisar padrões de falha
    this.analyzeFailurePatterns();
  }

  private analyzeFailurePatterns() {
    const recentFailures = this.failedRequests.filter(
      failure => Date.now() - failure.timestamp < 5 * 60 * 1000 // Últimos 5 minutos
    );

    if (recentFailures.length >= 5) {
      console.warn('🚨 High failure rate detected', {
        failures: recentFailures.length,
        timeWindow: '5 minutes'
      });
    }

    // Agrupar por tipo de erro
    const errorTypes = recentFailures.reduce((acc, failure) => {
      acc[failure.error] = (acc[failure.error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonError = Object.entries(errorTypes)
      .sort(([, a], [, b]) => b - a)[0];

    if (mostCommonError && mostCommonError[1] >= 3) {
      console.warn('🔍 Common error pattern detected', {
        error: mostCommonError[0],
        count: mostCommonError[1]
      });
    }
  }

  getNetworkStatus(): {
    quality: string;
    latency: number | null;
    bandwidth: number | null;
    failureRate: number;
    recommendations: string[];
  } {
    const avgLatency = this.latencyHistory.length > 0
      ? this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
      : null;

    const avgBandwidth = this.bandwidthHistory.length > 0
      ? this.bandwidthHistory.reduce((a, b) => a + b.bytesPerSecond, 0) / this.bandwidthHistory.length
      : null;

    const recentFailures = this.failedRequests.filter(
      failure => Date.now() - failure.timestamp < 10 * 60 * 1000 // Últimos 10 minutos
    );
    
    const failureRate = recentFailures.length;

    const recommendations = this.generateNetworkRecommendations(
      this.connectionQuality,
      avgLatency,
      avgBandwidth,
      failureRate
    );

    return {
      quality: this.connectionQuality,
      latency: avgLatency,
      bandwidth: avgBandwidth,
      failureRate,
      recommendations
    };
  }

  private generateNetworkRecommendations(
    quality: string,
    latency: number | null,
    bandwidth: number | null,
    failureRate: number
  ): string[] {
    const recommendations: string[] = [];

    if (quality === 'very_poor' || (latency && latency > 2000)) {
      recommendations.push('Very slow connection detected. Consider increasing sync intervals.');
      recommendations.push('Enable offline-first mode with reduced server communication.');
    }

    if (quality === 'poor' || (latency && latency > 1000)) {
      recommendations.push('Slow connection detected. Consider reducing batch sizes.');
      recommendations.push('Implement progressive sync for better user experience.');
    }

    if (bandwidth && bandwidth < 10 * 1024) { // < 10KB/s
      recommendations.push('Low bandwidth detected. Optimize payload sizes.');
      recommendations.push('Consider compression for large data transfers.');
    }

    if (failureRate > 5) {
      recommendations.push('High failure rate detected. Check server status and network stability.');
      recommendations.push('Implement exponential backoff for failed requests.');
    }

    return recommendations;
  }
}
```

## 🔧 Soluções para Problemas Comuns

### 1. Detecção de Conectividade Melhorada

```typescript
// utils/robustConnectivityDetector.ts
export class RobustConnectivityDetector {
  private isOnline: boolean = true;
  private lastSuccessfulPing: number = Date.now();
  private connectivityListeners: Array<(isOnline: boolean) => void> = [];

  constructor(private config: {
    pingUrl?: string;
    pingInterval?: number;
    timeout?: number;
    maxFailures?: number;
  } = {}) {
    this.config = {
      pingUrl: 'https://clients3.google.com/generate_204',
      pingInterval: 30000, // 30 segundos
      timeout: 10000, // 10 segundos
      maxFailures: 3,
      ...config
    };

    this.setupMultiLayerDetection();
  }

  private setupMultiLayerDetection() {
    // Layer 1: NetInfo (rápido mas impreciso)
    this.setupNetInfoDetection();
    
    // Layer 2: Ping periódico (mais confiável)
    this.setupPeriodicPing();
    
    // Layer 3: Request interceptor (real-time)
    this.setupRequestInterception();
  }

  private setupNetInfoDetection() {
    const NetInfo = require('@react-native-community/netinfo');
    
    NetInfo.addEventListener((state: any) => {
      // Use NetInfo como indicador inicial
      if (!state.isConnected) {
        this.updateConnectivityStatus(false, 'netinfo');
      } else if (state.isConnected && state.isInternetReachable) {
        // Verificar com ping se NetInfo diz que estamos online
        this.performConnectivityCheck();
      }
    });
  }

  private setupPeriodicPing() {
    setInterval(() => {
      this.performConnectivityCheck();
    }, this.config.pingInterval!);
  }

  private async performConnectivityCheck() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout!);

      const response = await fetch(this.config.pingUrl!, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.lastSuccessfulPing = Date.now();
        this.updateConnectivityStatus(true, 'ping');
      } else {
        this.updateConnectivityStatus(false, 'ping_failed');
      }

    } catch (error) {
      this.updateConnectivityStatus(false, 'ping_error');
    }
  }

  private setupRequestInterception() {
    // Interceptar fetch global para detectar falhas
    const originalFetch = global.fetch;
    
    global.fetch = async (...args: any[]) => {
      try {
        const response = await originalFetch.apply(global, args);
        
        if (response.ok) {
          // Request bem-sucedido = provavelmente online
          this.lastSuccessfulPing = Date.now();
          if (!this.isOnline) {
            this.updateConnectivityStatus(true, 'request_success');
          }
        } else if (response.status >= 500) {
          // Erro do servidor, não necessariamente problema de conectividade
        } else {
          // Outros erros podem indicar problema de conectividade
          this.handleRequestFailure('http_error');
        }
        
        return response;
      } catch (error) {
        this.handleRequestFailure('network_error');
        throw error;
      }
    };
  }

  private handleRequestFailure(reason: string) {
    // Se teve requests com sucesso recentemente, não considerar offline imediatamente
    const timeSinceLastSuccess = Date.now() - this.lastSuccessfulPing;
    
    if (timeSinceLastSuccess > 60000) { // 1 minuto
      this.updateConnectivityStatus(false, reason);
    }
  }

  private updateConnectivityStatus(online: boolean, reason: string) {
    if (this.isOnline !== online) {
      console.log(`🔄 Connectivity changed: ${online ? 'ONLINE' : 'OFFLINE'} (${reason})`);
      
      this.isOnline = online;
      
      // Notificar listeners
      this.connectivityListeners.forEach(listener => {
        try {
          listener(online);
        } catch (error) {
          console.error('Error in connectivity listener:', error);
        }
      });
    }
  }

  // Public API
  getConnectionStatus(): boolean {
    return this.isOnline;
  }

  addListener(listener: (isOnline: boolean) => void) {
    this.connectivityListeners.push(listener);
    
    // Retornar função para remover listener
    return () => {
      const index = this.connectivityListeners.indexOf(listener);
      if (index > -1) {
        this.connectivityListeners.splice(index, 1);
      }
    };
  }

  async forceConnectivityCheck(): Promise<boolean> {
    await this.performConnectivityCheck();
    return this.isOnline;
  }

  getTimeSinceLastSuccess(): number {
    return Date.now() - this.lastSuccessfulPing;
  }
}
```

### 2. Retry Strategy Inteligente

```typescript
// utils/smartRetryStrategy.ts
export class SmartRetryStrategy {
  private networkMonitor: AdvancedNetworkMonitor;
  
  constructor(networkMonitor: AdvancedNetworkMonitor) {
    this.networkMonitor = networkMonitor;
  }

  calculateRetryDelay(
    attempt: number,
    lastError: string,
    baseDelay: number = 1000
  ): number {
    const networkStatus = this.networkMonitor.getNetworkStatus();
    
    // Ajustar delay baseado na qualidade da conexão
    let qualityMultiplier = 1;
    switch (networkStatus.quality) {
      case 'very_poor':
        qualityMultiplier = 4;
        break;
      case 'poor':
        qualityMultiplier = 2;
        break;
      case 'good':
        qualityMultiplier = 1;
        break;
      case 'excellent':
        qualityMultiplier = 0.5;
        break;
    }

    // Exponential backoff com jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const adjustedDelay = exponentialDelay * qualityMultiplier;
    
    // Adicionar jitter (±25%)
    const jitter = adjustedDelay * 0.25 * (Math.random() - 0.5);
    const finalDelay = adjustedDelay + jitter;

    // Caps baseados no tipo de erro
    let maxDelay = 60000; // 1 minuto default
    
    if (lastError.includes('timeout')) {
      maxDelay = 120000; // 2 minutos para timeouts
    } else if (lastError.includes('network')) {
      maxDelay = 180000; // 3 minutos para erros de rede
    }

    return Math.min(finalDelay, maxDelay);
  }

  shouldRetry(
    attempt: number,
    maxRetries: number,
    lastError: string
  ): boolean {
    // Não retry para alguns tipos de erro
    const nonRetryableErrors = [
      'authorization',
      'forbidden',
      'not_found',
      'bad_request'
    ];

    if (nonRetryableErrors.some(error => lastError.toLowerCase().includes(error))) {
      return false;
    }

    // Aumentar tentativas para erros de rede
    if (lastError.includes('network') || lastError.includes('timeout')) {
      maxRetries = Math.min(maxRetries + 2, 8);
    }

    return attempt <= maxRetries;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      onRetry?: (attempt: number, error: string) => void;
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, baseDelay = 1000, onRetry } = options;
    
    let lastError = '';
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        this.networkMonitor.recordFailedRequest('retry-operation', lastError);
        
        if (attempt <= maxRetries && this.shouldRetry(attempt, maxRetries, lastError)) {
          const delay = this.calculateRetryDelay(attempt, lastError, baseDelay);
          
          console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after ${delay}ms`, {
            error: lastError,
            networkQuality: this.networkMonitor.getNetworkStatus().quality
          });
          
          onRetry?.(attempt, lastError);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error(lastError);
  }
}
```

### 3. Request Queue com Fallback

```typescript
// utils/requestQueueManager.ts
export class RequestQueueManager {
  private pendingRequests: Map<string, {
    request: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    priority: number;
    timestamp: number;
  }> = new Map();

  private isProcessing: boolean = false;
  private connectivityDetector: RobustConnectivityDetector;
  private retryStrategy: SmartRetryStrategy;

  constructor(
    connectivityDetector: RobustConnectivityDetector,
    retryStrategy: SmartRetryStrategy
  ) {
    this.connectivityDetector = connectivityDetector;
    this.retryStrategy = retryStrategy;
    
    this.setupConnectivityListener();
  }

  private setupConnectivityListener() {
    this.connectivityDetector.addListener((isOnline) => {
      if (isOnline && !this.isProcessing) {
        this.processQueue();
      }
    });
  }

  async queueRequest<T>(
    requestId: string,
    request: () => Promise<T>,
    priority: number = 1
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        request,
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      });

      // Processar imediatamente se online
      if (this.connectivityDetector.getConnectionStatus()) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.pendingRequests.size === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Ordenar por prioridade e timestamp
      const sortedRequests = Array.from(this.pendingRequests.entries())
        .sort(([, a], [, b]) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority; // Prioridade maior primeiro
          }
          return a.timestamp - b.timestamp; // Mais antigo primeiro
        });

      for (const [requestId, requestData] of sortedRequests) {
        if (!this.connectivityDetector.getConnectionStatus()) {
          console.log('📡 Connection lost, pausing queue processing');
          break;
        }

        try {
          console.log(`🚀 Processing request: ${requestId}`);
          
          const result = await this.retryStrategy.executeWithRetry(
            requestData.request,
            {
              maxRetries: 3,
              onRetry: (attempt, error) => {
                console.log(`🔄 Retrying request ${requestId} (attempt ${attempt}): ${error}`);
              }
            }
          );

          requestData.resolve(result);
          this.pendingRequests.delete(requestId);
          
          console.log(`✅ Request completed: ${requestId}`);

        } catch (error) {
          console.error(`❌ Request failed permanently: ${requestId}`, error);
          requestData.reject(error);
          this.pendingRequests.delete(requestId);
        }

        // Pequeno delay entre requests para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } finally {
      this.isProcessing = false;
      
      // Se ainda há requests pendentes e estamos online, continuar processando
      if (this.pendingRequests.size > 0 && this.connectivityDetector.getConnectionStatus()) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  getQueueStatus(): {
    pendingCount: number;
    isProcessing: boolean;
    oldestRequest?: number;
  } {
    const timestamps = Array.from(this.pendingRequests.values()).map(r => r.timestamp);
    const oldestRequest = timestamps.length > 0 ? Math.min(...timestamps) : undefined;

    return {
      pendingCount: this.pendingRequests.size,
      isProcessing: this.isProcessing,
      oldestRequest
    };
  }

  clearQueue() {
    this.pendingRequests.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.pendingRequests.clear();
  }

  removeRequest(requestId: string): boolean {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      request.reject(new Error('Request cancelled'));
      this.pendingRequests.delete(requestId);
      return true;
    }
    return false;
  }
}
```

### 4. Configuração para Diferentes Cenários de Rede

```typescript
// utils/networkAdaptiveConfig.ts
export class NetworkAdaptiveConfig {
  private currentConfig: any;
  private baseConfig: any;
  private networkMonitor: AdvancedNetworkMonitor;

  constructor(baseConfig: any, networkMonitor: AdvancedNetworkMonitor) {
    this.baseConfig = baseConfig;
    this.networkMonitor = networkMonitor;
    this.currentConfig = { ...baseConfig };
    
    this.setupAdaptiveConfiguration();
  }

  private setupAdaptiveConfiguration() {
    setInterval(() => {
      this.adaptConfigurationToNetwork();
    }, 30000); // Reavaliar a cada 30 segundos
  }

  private adaptConfigurationToNetwork() {
    const networkStatus = this.networkMonitor.getNetworkStatus();
    const newConfig = this.generateAdaptedConfig(networkStatus);
    
    if (this.hasConfigChanged(newConfig)) {
      console.log('⚙️ Adapting configuration to network conditions', {
        quality: networkStatus.quality,
        latency: networkStatus.latency,
        bandwidth: networkStatus.bandwidth
      });
      
      this.currentConfig = newConfig;
      this.notifyConfigurationChange(newConfig);
    }
  }

  private generateAdaptedConfig(networkStatus: any): any {
    const config = { ...this.baseConfig };

    switch (networkStatus.quality) {
      case 'very_poor':
        return {
          ...config,
          syncInterval: 120000, // 2 minutos
          batchSize: 5,
          requestTimeout: 60000, // 1 minuto
          maxRetries: 5,
          maxConcurrentRequests: 1
        };

      case 'poor':
        return {
          ...config,
          syncInterval: 60000, // 1 minuto
          batchSize: 10,
          requestTimeout: 30000,
          maxRetries: 4,
          maxConcurrentRequests: 2
        };

      case 'good':
        return {
          ...config,
          syncInterval: 30000,
          batchSize: 25,
          requestTimeout: 15000,
          maxRetries: 3,
          maxConcurrentRequests: 3
        };

      case 'excellent':
        return {
          ...config,
          syncInterval: 15000,
          batchSize: 50,
          requestTimeout: 10000,
          maxRetries: 2,
          maxConcurrentRequests: 5
        };

      default:
        return config;
    }
  }

  private hasConfigChanged(newConfig: any): boolean {
    const keys = ['syncInterval', 'batchSize', 'requestTimeout', 'maxRetries'];
    return keys.some(key => this.currentConfig[key] !== newConfig[key]);
  }

  private notifyConfigurationChange(newConfig: any) {
    // Implementar notificação para o SyncEngine
    // Por exemplo, emit event ou callback
  }

  getCurrentConfig(): any {
    return { ...this.currentConfig };
  }

  getNetworkAdaptedTimeout(): number {
    const networkStatus = this.networkMonitor.getNetworkStatus();
    
    if (networkStatus.latency) {
      // Timeout baseado na latência: 3x latência + buffer
      return Math.max(
        networkStatus.latency * 3 + 5000,
        this.currentConfig.requestTimeout
      );
    }
    
    return this.currentConfig.requestTimeout;
  }

  shouldSkipSync(): boolean {
    const networkStatus = this.networkMonitor.getNetworkStatus();
    
    // Skip sync se rede muito ruim ou muitas falhas recentes
    return networkStatus.quality === 'very_poor' || networkStatus.failureRate > 10;
  }
}
```

## 📱 Soluções Específicas por Plataforma

### iOS Specific Issues

```typescript
// utils/iosNetworkFixes.ts
export class iOSNetworkFixes {
  static setupiOSSpecificFixes() {
    // Fix para iOS background app refresh
    if (Platform.OS === 'ios') {
      // Configure reachability test para iOS
      const NetInfo = require('@react-native-community/netinfo');
      
      NetInfo.configure({
        reachabilityUrl: 'https://clients3.google.com/generate_204',
        reachabilityTest: async (response: Response) => response.status === 204,
        reachabilityLongTimeout: 60 * 1000, // 60s
        reachabilityShortTimeout: 5 * 1000, // 5s
        reachabilityRequestTimeout: 15 * 1000, // 15s
      });
    }
  }

  static handleCellularDataRestriction() {
    if (Platform.OS === 'ios') {
      // Verificar se dados celulares estão permitidos
      return new Promise((resolve) => {
        const NetInfo = require('@react-native-community/netinfo');
        
        NetInfo.fetch().then((state: any) => {
          if (state.type === 'cellular' && !state.details.isConnectionExpensive) {
            console.warn('📱 Cellular data may be restricted for this app');
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    }
    
    return Promise.resolve(true);
  }
}
```

### Android Specific Issues

```typescript
// utils/androidNetworkFixes.ts
export class AndroidNetworkFixes {
  static setupAndroidSpecificFixes() {
    if (Platform.OS === 'android') {
      // Fix para Android data saver mode
      this.checkDataSaverMode();
      
      // Fix para Android background restrictions
      this.checkBackgroundRestrictions();
    }
  }

  private static checkDataSaverMode() {
    // Verificar se Data Saver está ativo
    // Implementar verificação específica do Android
    console.log('📱 Checking Android Data Saver mode...');
  }

  private static checkBackgroundRestrictions() {
    // Verificar se app pode fazer requests em background
    console.log('📱 Checking Android background restrictions...');
  }

  static handleNetworkSecurityConfig() {
    // Lidar com Network Security Config do Android
    // Para desenvolvimento com HTTP em localhost
    if (__DEV__) {
      console.log('📱 Development mode: allowing cleartext traffic');
    }
  }
}
```

## 🔧 Network Diagnostic Tools

### Network Health Dashboard

```typescript
// components/NetworkHealthDashboard.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface NetworkHealthDashboardProps {
  networkMonitor: AdvancedNetworkMonitor;
  connectivityDetector: RobustConnectivityDetector;
}

export const NetworkHealthDashboard: React.FC<NetworkHealthDashboardProps> = ({
  networkMonitor,
  connectivityDetector
}) => {
  const [networkStatus, setNetworkStatus] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [connectivityTest, setConnectivityTest] = useState<any>(null);

  useEffect(() => {
    const updateStatus = () => {
      setNetworkStatus(networkMonitor.getNetworkStatus());
      setIsOnline(connectivityDetector.getConnectionStatus());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, [networkMonitor, connectivityDetector]);

  const runConnectivityTest = async () => {
    console.log('🔍 Running connectivity test...');
    const debugger = new NetworkConnectivityDebugger();
    const results = await debugger.performConnectivityTest();
    setConnectivityTest(results);
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return '#10B981';
      case 'good': return '#3B82F6';
      case 'poor': return '#F59E0B';
      case 'very_poor': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        Network Health Dashboard
      </Text>

      {/* Connection Status */}
      <View style={{
        backgroundColor: isOnline ? '#d4edda' : '#f8d7da',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16
      }}>
        <Text style={{
          fontSize: 16,
          fontWeight: 'bold',
          color: isOnline ? '#155724' : '#721c24'
        }}>
          {isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}
        </Text>
        <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          Last successful connection: {
            new Date(Date.now() - connectivityDetector.getTimeSinceLastSuccess()).toLocaleTimeString()
          }
        </Text>
      </View>

      {/* Network Quality */}
      {networkStatus && (
        <View style={{
          backgroundColor: '#f5f5f5',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
            Network Quality
          </Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ flex: 1 }}>Quality:</Text>
            <Text style={{
              fontWeight: 'bold',
              color: getQualityColor(networkStatus.quality)
            }}>
              {networkStatus.quality.toUpperCase()}
            </Text>
          </View>

          {networkStatus.latency && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ flex: 1 }}>Latency:</Text>
              <Text>{Math.round(networkStatus.latency)}ms</Text>
            </View>
          )}

          {networkStatus.bandwidth && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ flex: 1 }}>Bandwidth:</Text>
              <Text>{(networkStatus.bandwidth / 1024).toFixed(1)} KB/s</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1 }}>Failure Rate:</Text>
            <Text style={{
              color: networkStatus.failureRate > 5 ? '#EF4444' : '#6B7280'
            }}>
              {networkStatus.failureRate}/10min
            </Text>
          </View>
        </View>
      )}

      {/* Recommendations */}
      {networkStatus && networkStatus.recommendations.length > 0 && (
        <View style={{
          backgroundColor: '#fff3cd',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
            💡 Recommendations
          </Text>
          {networkStatus.recommendations.map((rec: string, index: number) => (
            <Text key={index} style={{ fontSize: 12, marginBottom: 4 }}>
              • {rec}
            </Text>
          ))}
        </View>
      )}

      {/* Connectivity Test */}
      <TouchableOpacity
        style={{
          backgroundColor: '#3B82F6',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16
        }}
        onPress={runConnectivityTest}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
          🔍 Run Connectivity Test
        </Text>
      </TouchableOpacity>

      {connectivityTest && (
        <View style={{
          backgroundColor: '#f5f5f5',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
            Connectivity Test Results
          </Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ flex: 1 }}>DNS Resolution:</Text>
            <Text style={{ color: connectivityTest.dnsResolution ? '#10B981' : '#EF4444' }}>
              {connectivityTest.dnsResolution ? '✅' : '❌'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ flex: 1 }}>Internet Access:</Text>
            <Text style={{ color: connectivityTest.canReachInternet ? '#10B981' : '#EF4444' }}>
              {connectivityTest.canReachInternet ? '✅' : '❌'}
              {connectivityTest.internetResponseTime && ` (${connectivityTest.internetResponseTime}ms)`}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1 }}>Server Access:</Text>
            <Text style={{ color: connectivityTest.canReachServer ? '#10B981' : '#EF4444' }}>
              {connectivityTest.canReachServer ? '✅' : '❌'}
              {connectivityTest.serverResponseTime && ` (${connectivityTest.serverResponseTime}ms)`}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
};
```

## 🎯 Checklist de Conectividade

### ✅ Detecção de Conectividade
- [ ] NetInfo configurado corretamente
- [ ] Ping periódico implementado
- [ ] Request interceptor para detecção real-time
- [ ] Fallback para múltiplas URLs de teste

### ✅ Retry Strategy
- [ ] Exponential backoff implementado
- [ ] Jitter adicionado para evitar thundering herd
- [ ] Diferentes strategies por tipo de erro
- [ ] Limites baseados na qualidade da rede

### ✅ Request Queue
- [ ] Queue persiste durante desconexões
- [ ] Priorização de requests implementada
- [ ] Processamento automático quando volta online
- [ ] Timeout adaptativo baseado na rede

### ✅ Configuração Adaptativa
- [ ] Parâmetros ajustam baseado na qualidade da rede
- [ ] Monitoramento contínuo de latência e bandwidth
- [ ] Configurações específicas por tipo de conexão
- [ ] Fallback para modo offline em redes muito ruins

### ✅ Plataforma Específica
- [ ] Configurações iOS aplicadas
- [ ] Workarounds Android implementados
- [ ] Data saver mode detectado
- [ ] Background restrictions consideradas

Com estas ferramentas e estratégias, você pode criar uma experiência robusta mesmo em condições de rede adversas, mantendo seu app funcional independente da qualidade da conectividade.