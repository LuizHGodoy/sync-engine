# Logs e Diagnóstico

Um sistema robusto de logging e diagnóstico é essencial para identificar e resolver problemas em aplicações offline-first. Este guia apresenta estratégias para capturar, analisar e interpretar logs do Sync Engine.

## 📝 Configuração de Logging

### 1. Habilitando Debug Mode

```typescript
import { SyncEngineFactory } from 'sync-engine-lib';

// ✅ Configuração para desenvolvimento
const syncEngine = SyncEngineFactory.createForDevelopment(
  'https://api.example.com',
  {
    debug: true, // Habilita logs detalhados
    config: {
      syncInterval: 10000, // Sync mais frequente para debug
    }
  }
);
```

### 2. Custom Logger Implementation

```typescript
// utils/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class SyncLogger {
  private currentLevel: LogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;
  private logs: Array<{
    level: LogLevel;
    message: string;
    data?: any;
    timestamp: number;
    context?: string;
  }> = [];
  
  private maxLogs: number = 1000;

  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  debug(message: string, data?: any, context?: string) {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  info(message: string, data?: any, context?: string) {
    this.log(LogLevel.INFO, message, data, context);
  }

  warn(message: string, data?: any, context?: string) {
    this.log(LogLevel.WARN, message, data, context);
  }

  error(message: string, error?: any, context?: string) {
    this.log(LogLevel.ERROR, message, error, context);
  }

  private log(level: LogLevel, message: string, data?: any, context?: string) {
    if (level < this.currentLevel) return;

    const logEntry = {
      level,
      message,
      data,
      timestamp: Date.now(),
      context
    };

    this.logs.push(logEntry);
    
    // Manter apenas os últimos N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output no console
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    const emoji = this.getLevelEmoji(level);
    
    const logMessage = `${emoji} ${timestamp} ${contextStr} ${message}`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, data || '');
        break;
      case LogLevel.INFO:
        console.info(logMessage, data || '');
        break;
      case LogLevel.WARN:
        console.warn(logMessage, data || '');
        break;
      case LogLevel.ERROR:
        console.error(logMessage, data || '');
        break;
    }
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '🔍';
      case LogLevel.INFO: return 'ℹ️';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      default: return '📝';
    }
  }

  // Métodos utilitários
  getLogs(level?: LogLevel, context?: string, limit?: number): any[] {
    let filteredLogs = this.logs;

    if (level !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level >= level);
    }

    if (context) {
      filteredLogs = filteredLogs.filter(log => log.context === context);
    }

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  getRecentErrors(limit: number = 10): any[] {
    return this.getLogs(LogLevel.ERROR, undefined, limit);
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  clearLogs() {
    this.logs = [];
  }

  // Análise de logs
  analyzeLogPatterns(): {
    errorFrequency: number;
    warningFrequency: number;
    mostCommonErrors: Array<{ message: string; count: number }>;
    timeSpan: { start: number; end: number };
  } {
    const errors = this.logs.filter(log => log.level === LogLevel.ERROR);
    const warnings = this.logs.filter(log => log.level === LogLevel.WARN);
    
    // Agrupa erros por mensagem
    const errorCounts = errors.reduce((acc, error) => {
      acc[error.message] = (acc[error.message] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonErrors = Object.entries(errorCounts)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const timestamps = this.logs.map(log => log.timestamp);
    const timeSpan = {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps)
    };

    return {
      errorFrequency: errors.length,
      warningFrequency: warnings.length,
      mostCommonErrors,
      timeSpan
    };
  }
}

export const logger = new SyncLogger();
```

### 3. Integração com Sync Engine

```typescript
// Wrapper do SyncEngine com logging
export class LoggedSyncEngine {
  private syncEngine: any;
  private logger: SyncLogger;

  constructor(syncEngine: any, logger: SyncLogger) {
    this.syncEngine = syncEngine;
    this.logger = logger;
    this.setupLogging();
  }

  private setupLogging() {
    // Log operações da queue
    const originalAddToQueue = this.syncEngine.addToQueue;
    this.syncEngine.addToQueue = async (...args: any[]) => {
      const [id, type, payload] = args;
      this.logger.debug(`Adding to queue: ${type}:${id}`, { payload }, 'QUEUE');
      
      try {
        const result = await originalAddToQueue.apply(this.syncEngine, args);
        this.logger.debug(`Successfully added to queue: ${type}:${id}`, null, 'QUEUE');
        return result;
      } catch (error) {
        this.logger.error(`Failed to add to queue: ${type}:${id}`, error, 'QUEUE');
        throw error;
      }
    };

    // Log operações de sync
    const originalForceSync = this.syncEngine.forceSync;
    this.syncEngine.forceSync = async (...args: any[]) => {
      this.logger.info('Starting force sync', null, 'SYNC');
      
      try {
        const result = await originalForceSync.apply(this.syncEngine, args);
        this.logger.info('Force sync completed', {
          syncedItems: result.syncedItems,
          errors: result.errors,
          duration: result.duration
        }, 'SYNC');
        return result;
      } catch (error) {
        this.logger.error('Force sync failed', error, 'SYNC');
        throw error;
      }
    };

    // Log eventos do sync engine
    this.syncEngine.addEventListener((event: any) => {
      this.logSyncEvent(event);
    });

    // Log mudanças de status
    this.setupStatusMonitoring();
  }

  private logSyncEvent(event: any) {
    const context = 'EVENT';
    
    switch (event.type) {
      case 'sync_started':
        this.logger.info('Sync started', event.data, context);
        break;
        
      case 'sync_completed':
        this.logger.info('Sync completed', {
          syncedItems: event.data?.syncedItems,
          duration: event.data?.duration
        }, context);
        break;
        
      case 'sync_failed':
        this.logger.error('Sync failed', event.error, context);
        break;
        
      case 'item_queued':
        this.logger.debug('Item queued', {
          id: event.data?.id,
          type: event.data?.type
        }, context);
        break;
        
      case 'item_synced':
        this.logger.debug('Item synced', {
          id: event.data?.id,
          type: event.data?.type
        }, context);
        break;
        
      case 'item_failed':
        this.logger.warn('Item sync failed', {
          id: event.data?.id,
          type: event.data?.type,
          error: event.error
        }, context);
        break;
        
      case 'connection_changed':
        this.logger.info('Connection state changed', {
          isOnline: event.data?.isOnline,
          type: event.data?.type
        }, context);
        break;
        
      case 'conflict_detected':
        this.logger.warn('Conflict detected', {
          id: event.data?.id,
          conflictType: event.data?.conflictType
        }, context);
        break;
        
      default:
        this.logger.debug(`Unknown event: ${event.type}`, event.data, context);
    }
  }

  private setupStatusMonitoring() {
    let lastStatus: any = null;
    
    setInterval(async () => {
      try {
        const currentStatus = await this.syncEngine.getStatus();
        
        if (lastStatus) {
          // Log mudanças significativas
          if (lastStatus.isOnline !== currentStatus.isOnline) {
            this.logger.info(`Connection changed: ${lastStatus.isOnline ? 'online' : 'offline'} → ${currentStatus.isOnline ? 'online' : 'offline'}`, null, 'STATUS');
          }
          
          if (lastStatus.pendingItems !== currentStatus.pendingItems) {
            this.logger.debug(`Queue size changed: ${lastStatus.pendingItems} → ${currentStatus.pendingItems}`, null, 'STATUS');
          }
          
          if (lastStatus.errorItems !== currentStatus.errorItems) {
            this.logger.warn(`Error items changed: ${lastStatus.errorItems} → ${currentStatus.errorItems}`, null, 'STATUS');
          }
        }
        
        lastStatus = currentStatus;
      } catch (error) {
        this.logger.error('Failed to get status', error, 'STATUS');
      }
    }, 10000); // Check every 10 seconds
  }

  // Proxy outros métodos
  async initialize() {
    this.logger.info('Initializing SyncEngine', null, 'INIT');
    try {
      await this.syncEngine.initialize();
      this.logger.info('SyncEngine initialized successfully', null, 'INIT');
    } catch (error) {
      this.logger.error('SyncEngine initialization failed', error, 'INIT');
      throw error;
    }
  }

  async start() {
    this.logger.info('Starting SyncEngine', null, 'LIFECYCLE');
    try {
      await this.syncEngine.start();
      this.logger.info('SyncEngine started successfully', null, 'LIFECYCLE');
    } catch (error) {
      this.logger.error('SyncEngine start failed', error, 'LIFECYCLE');
      throw error;
    }
  }

  async stop() {
    this.logger.info('Stopping SyncEngine', null, 'LIFECYCLE');
    await this.syncEngine.stop();
    this.logger.info('SyncEngine stopped', null, 'LIFECYCLE');
  }

  // Delegate outros métodos
  addToQueue = this.syncEngine.addToQueue;
  forceSync = this.syncEngine.forceSync;
  getStatus = this.syncEngine.getStatus.bind(this.syncEngine);
  getQueuedItems = this.syncEngine.getQueuedItems.bind(this.syncEngine);
  // ... outros métodos
}
```

## 🔍 Ferramentas de Diagnóstico

### 1. Health Check Automático

```typescript
// utils/healthCheck.ts
export class SyncHealthChecker {
  private syncEngine: any;
  private logger: SyncLogger;
  private checkInterval?: NodeJS.Timeout;

  constructor(syncEngine: any, logger: SyncLogger) {
    this.syncEngine = syncEngine;
    this.logger = logger;
  }

  startMonitoring(intervalMs: number = 30000) {
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
    
    this.logger.info('Health monitoring started', { intervalMs }, 'HEALTH');
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      this.logger.info('Health monitoring stopped', null, 'HEALTH');
    }
  }

  async performHealthCheck(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    checks: Record<string, any>;
  }> {
    const checks: Record<string, any> = {};
    let criticalIssues = 0;
    let warnings = 0;

    try {
      // 1. Status check
      const status = await this.syncEngine.getStatus();
      checks.status = {
        healthy: status.isActive && status.isOnline,
        details: status,
        issues: []
      };

      if (!status.isActive) {
        checks.status.issues.push('SyncEngine not active');
        criticalIssues++;
      }

      if (!status.isOnline) {
        checks.status.issues.push('Device offline');
        warnings++;
      }

      if (status.errorItems > 0) {
        checks.status.issues.push(`${status.errorItems} items with errors`);
        warnings++;
      }

      // 2. Queue health
      const queueItems = await this.syncEngine.getQueuedItems();
      const queueHealth = this.analyzeQueueHealth(queueItems);
      checks.queue = queueHealth;

      if (queueHealth.stuckItems > 0) {
        warnings++;
      }

      if (queueHealth.totalItems > 1000) {
        checks.queue.issues.push('Queue size very large');
        warnings++;
      }

      // 3. Connectivity check
      const connectivityCheck = await this.checkServerConnectivity();
      checks.connectivity = connectivityCheck;

      if (!connectivityCheck.healthy) {
        criticalIssues++;
      }

      // 4. Performance check
      const perfCheck = await this.checkPerformance();
      checks.performance = perfCheck;

      if (!perfCheck.healthy) {
        warnings++;
      }

      // 5. Determinar health geral
      let overall: 'healthy' | 'warning' | 'critical';
      if (criticalIssues > 0) {
        overall = 'critical';
      } else if (warnings > 0) {
        overall = 'warning';
      } else {
        overall = 'healthy';
      }

      // Log resultado
      const message = `Health check completed: ${overall}`;
      if (overall === 'critical') {
        this.logger.error(message, { checks }, 'HEALTH');
      } else if (overall === 'warning') {
        this.logger.warn(message, { checks }, 'HEALTH');
      } else {
        this.logger.debug(message, { checks }, 'HEALTH');
      }

      return { overall, checks };

    } catch (error) {
      this.logger.error('Health check failed', error, 'HEALTH');
      return {
        overall: 'critical',
        checks: { error: { healthy: false, error: error.message } }
      };
    }
  }

  private analyzeQueueHealth(queueItems: any[]) {
    const statusCounts = queueItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const stuckItems = queueItems.filter(item => 
      item.retries > 5 || 
      (item.status === 'syncing' && Date.now() - item.updatedAt > 60000)
    ).length;

    const avgRetries = queueItems.reduce((sum, item) => sum + item.retries, 0) / queueItems.length || 0;

    return {
      healthy: stuckItems === 0 && avgRetries < 2,
      totalItems: queueItems.length,
      statusCounts,
      stuckItems,
      avgRetries,
      issues: stuckItems > 0 ? [`${stuckItems} stuck items detected`] : []
    };
  }

  private async checkServerConnectivity() {
    try {
      const config = this.syncEngine.getConfig();
      const startTime = Date.now();
      
      const response = await fetch(`${config.serverUrl}/health`, {
        method: 'GET',
        timeout: 10000
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: response.ok,
        responseTime,
        status: response.status,
        issues: response.ok ? [] : [`Server returned ${response.status}`]
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        issues: ['Server unreachable']
      };
    }
  }

  private async checkPerformance() {
    try {
      const startTime = Date.now();
      const status = await this.syncEngine.getStatus();
      const statusTime = Date.now() - startTime;

      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

      return {
        healthy: statusTime < 1000 && heapUsedMB < 200,
        statusQueryTime: statusTime,
        memoryUsageMB: heapUsedMB,
        issues: [
          ...(statusTime > 1000 ? ['Slow status queries'] : []),
          ...(heapUsedMB > 200 ? ['High memory usage'] : [])
        ]
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        issues: ['Performance check failed']
      };
    }
  }
}
```

### 2. Log Analysis Tools

```typescript
// utils/logAnalyzer.ts
export class LogAnalyzer {
  private logger: SyncLogger;

  constructor(logger: SyncLogger) {
    this.logger = logger;
  }

  generateDiagnosticReport(): {
    summary: any;
    patterns: any;
    recommendations: string[];
  } {
    const logs = this.logger.getLogs();
    const analysis = this.logger.analyzeLogPatterns();

    // Análise de padrões
    const patterns = this.analyzePatterns(logs);
    
    // Gerar recomendações
    const recommendations = this.generateRecommendations(analysis, patterns);

    return {
      summary: {
        totalLogs: logs.length,
        timeSpan: analysis.timeSpan,
        errorCount: analysis.errorFrequency,
        warningCount: analysis.warningFrequency,
        mostCommonErrors: analysis.mostCommonErrors
      },
      patterns,
      recommendations
    };
  }

  private analyzePatterns(logs: any[]) {
    // Análise temporal
    const hourlyDistribution = this.analyzeHourlyDistribution(logs);
    
    // Análise de contexto
    const contextDistribution = this.analyzeContextDistribution(logs);
    
    // Análise de sequências de erro
    const errorSequences = this.analyzeErrorSequences(logs);
    
    // Análise de performance
    const performanceMetrics = this.analyzePerformanceMetrics(logs);

    return {
      hourlyDistribution,
      contextDistribution,
      errorSequences,
      performanceMetrics
    };
  }

  private analyzeHourlyDistribution(logs: any[]) {
    const distribution = Array(24).fill(0);
    
    logs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      distribution[hour]++;
    });

    return distribution;
  }

  private analyzeContextDistribution(logs: any[]) {
    return logs.reduce((acc, log) => {
      const context = log.context || 'unknown';
      acc[context] = (acc[context] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private analyzeErrorSequences(logs: any[]) {
    const errors = logs.filter(log => log.level === LogLevel.ERROR);
    const sequences: Array<{ start: number; end: number; count: number }> = [];
    
    let currentSequence: { start: number; count: number } | null = null;
    
    errors.forEach(error => {
      if (!currentSequence) {
        currentSequence = { start: error.timestamp, count: 1 };
      } else {
        const timeDiff = error.timestamp - currentSequence.start;
        if (timeDiff < 60000) { // 1 minuto
          currentSequence.count++;
        } else {
          sequences.push({
            start: currentSequence.start,
            end: error.timestamp - timeDiff,
            count: currentSequence.count
          });
          currentSequence = { start: error.timestamp, count: 1 };
        }
      }
    });

    return sequences.filter(seq => seq.count > 1);
  }

  private analyzePerformanceMetrics(logs: any[]) {
    const syncLogs = logs.filter(log => 
      log.context === 'SYNC' && log.message.includes('completed')
    );

    const durations = syncLogs
      .map(log => log.data?.duration)
      .filter(duration => typeof duration === 'number');

    if (durations.length === 0) {
      return { avgDuration: null, maxDuration: null, minDuration: null };
    }

    return {
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      count: durations.length
    };
  }

  private generateRecommendations(analysis: any, patterns: any): string[] {
    const recommendations: string[] = [];

    // Recomendações baseadas em erros
    if (analysis.errorFrequency > 10) {
      recommendations.push('High error frequency detected. Check server connectivity and configuration.');
    }

    if (analysis.mostCommonErrors.length > 0) {
      const topError = analysis.mostCommonErrors[0];
      recommendations.push(`Most common error: "${topError.message}" (${topError.count} occurrences). Focus on resolving this issue first.`);
    }

    // Recomendações baseadas em performance
    if (patterns.performanceMetrics.avgDuration > 30000) {
      recommendations.push('Sync operations are taking too long. Consider reducing batch size or optimizing server performance.');
    }

    // Recomendações baseadas em sequências de erro
    if (patterns.errorSequences.length > 0) {
      recommendations.push('Error bursts detected. This might indicate network instability or server issues.');
    }

    // Recomendações baseadas em contexto
    const totalLogs = Object.values(patterns.contextDistribution).reduce((a: number, b: number) => a + b, 0);
    const queueLogs = patterns.contextDistribution.QUEUE || 0;
    
    if (queueLogs / totalLogs > 0.5) {
      recommendations.push('High queue activity detected. Monitor queue performance and consider optimizing queue operations.');
    }

    return recommendations;
  }

  exportReport(): string {
    const report = this.generateDiagnosticReport();
    return JSON.stringify(report, null, 2);
  }
}
```

## 📊 Dashboard de Logs

### Log Viewer Component

```typescript
// components/LogViewer.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';

interface LogViewerProps {
  logger: SyncLogger;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logger }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState<{
    level?: LogLevel;
    context?: string;
    search?: string;
  }>({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    updateLogs();
    
    if (autoRefresh) {
      const interval = setInterval(updateLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [filter, autoRefresh]);

  const updateLogs = () => {
    let filteredLogs = logger.getLogs(filter.level, filter.context, 100);
    
    if (filter.search) {
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(filter.search!.toLowerCase())
      );
    }
    
    setLogs(filteredLogs.reverse()); // Most recent first
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.DEBUG: return '#6B7280';
      case LogLevel.INFO: return '#3B82F6';
      case LogLevel.WARN: return '#F59E0B';
      case LogLevel.ERROR: return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getLevelText = (level: LogLevel) => {
    switch (level) {
      case LogLevel.DEBUG: return 'DEBUG';
      case LogLevel.INFO: return 'INFO';
      case LogLevel.WARN: return 'WARN';
      case LogLevel.ERROR: return 'ERROR';
      default: return 'LOG';
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* Controls */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          Sync Engine Logs
        </Text>
        
        {/* Search */}
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 4,
            padding: 8,
            marginBottom: 8
          }}
          placeholder="Search logs..."
          value={filter.search || ''}
          onChangeText={(text) => setFilter({ ...filter, search: text })}
        />
        
        {/* Level filter */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          {[undefined, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR].map(level => (
            <TouchableOpacity
              key={level ?? 'all'}
              style={{
                padding: 8,
                margin: 4,
                borderRadius: 4,
                backgroundColor: filter.level === level ? '#3B82F6' : '#f0f0f0'
              }}
              onPress={() => setFilter({ ...filter, level })}
            >
              <Text style={{ 
                color: filter.level === level ? 'white' : 'black',
                fontSize: 12
              }}>
                {level !== undefined ? getLevelText(level) : 'ALL'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Auto refresh toggle */}
        <TouchableOpacity
          style={{
            padding: 8,
            backgroundColor: autoRefresh ? '#10B981' : '#6B7280',
            borderRadius: 4,
            alignSelf: 'flex-start'
          }}
          onPress={() => setAutoRefresh(!autoRefresh)}
        >
          <Text style={{ color: 'white', fontSize: 12 }}>
            Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Logs */}
      <ScrollView style={{ flex: 1 }}>
        {logs.map((log, index) => (
          <View
            key={index}
            style={{
              backgroundColor: '#f8f8f8',
              padding: 8,
              marginBottom: 4,
              borderRadius: 4,
              borderLeftWidth: 4,
              borderLeftColor: getLevelColor(log.level)
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ 
                fontSize: 10, 
                color: getLevelColor(log.level),
                fontWeight: 'bold'
              }}>
                {getLevelText(log.level)}
                {log.context && ` [${log.context}]`}
              </Text>
              <Text style={{ fontSize: 10, color: '#6B7280' }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </Text>
            </View>
            
            {/* Message */}
            <Text style={{ fontSize: 12, marginBottom: 4 }}>
              {log.message}
            </Text>
            
            {/* Data */}
            {log.data && (
              <Text style={{ 
                fontSize: 10, 
                fontFamily: 'monospace',
                color: '#6B7280',
                backgroundColor: '#f0f0f0',
                padding: 4,
                borderRadius: 2
              }}>
                {JSON.stringify(log.data, null, 2)}
              </Text>
            )}
          </View>
        ))}
        
        {logs.length === 0 && (
          <Text style={{ textAlign: 'center', color: '#6B7280', marginTop: 20 }}>
            No logs found
          </Text>
        )}
      </ScrollView>
    </View>
  );
};
```

## 🔧 Configuração para Produção

### 1. Log Aggregation

```typescript
// services/logAggregation.ts
export class LogAggregationService {
  private logger: SyncLogger;
  private apiEndpoint: string;
  private userId?: string;
  private sessionId: string;

  constructor(logger: SyncLogger, config: {
    apiEndpoint: string;
    userId?: string;
  }) {
    this.logger = logger;
    this.apiEndpoint = config.apiEndpoint;
    this.userId = config.userId;
    this.sessionId = this.generateSessionId();
    
    this.setupLogUpload();
  }

  private setupLogUpload() {
    // Upload logs periodicamente
    setInterval(() => {
      this.uploadLogs();
    }, 5 * 60 * 1000); // A cada 5 minutos
    
    // Upload imediato para erros críticos
    this.logger.addEventListener?.((log) => {
      if (log.level === LogLevel.ERROR) {
        this.uploadSingleLog(log);
      }
    });
  }

  private async uploadLogs() {
    try {
      const recentLogs = this.logger.getLogs(LogLevel.INFO, undefined, 100);
      
      if (recentLogs.length === 0) return;
      
      await this.sendLogsToServer(recentLogs);
      
    } catch (error) {
      console.warn('Failed to upload logs:', error);
    }
  }

  private async uploadSingleLog(log: any) {
    try {
      await this.sendLogsToServer([log]);
    } catch (error) {
      console.warn('Failed to upload single log:', error);
    }
  }

  private async sendLogsToServer(logs: any[]) {
    const payload = {
      sessionId: this.sessionId,
      userId: this.userId,
      deviceInfo: this.getDeviceInfo(),
      timestamp: Date.now(),
      logs: logs.map(log => ({
        ...log,
        deviceTimestamp: log.timestamp
      }))
    };

    await fetch(`${this.apiEndpoint}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
  }

  private getDeviceInfo() {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      // Adicionar outras informações relevantes
    };
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 2. Production Logger Config

```typescript
// utils/productionLogger.ts
export const setupProductionLogging = (syncEngine: any, config: {
  logLevel: LogLevel;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  userId?: string;
}) => {
  const logger = new SyncLogger();
  logger.setLevel(config.logLevel);

  // Setup remote logging se habilitado
  if (config.enableRemoteLogging && config.remoteEndpoint) {
    const aggregationService = new LogAggregationService(logger, {
      apiEndpoint: config.remoteEndpoint,
      userId: config.userId
    });
  }

  // Setup health monitoring
  const healthChecker = new SyncHealthChecker(syncEngine, logger);
  healthChecker.startMonitoring(60000); // Check every minute

  // Wrap sync engine com logging
  const loggedSyncEngine = new LoggedSyncEngine(syncEngine, logger);

  return {
    syncEngine: loggedSyncEngine,
    logger,
    healthChecker
  };
};
```

## 📈 Métricas e Monitoramento

### Performance Metrics

```typescript
// utils/performanceMetrics.ts
export class PerformanceMetrics {
  private metrics: Map<string, Array<{
    value: number;
    timestamp: number;
  }>> = new Map();

  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push({ value, timestamp: Date.now() });
    
    // Manter apenas últimas 1000 medições
    if (values.length > 1000) {
      values.shift();
    }
  }

  getMetricSummary(name: string) {
    const values = this.metrics.get(name) || [];
    
    if (values.length === 0) {
      return null;
    }
    
    const numericValues = values.map(v => v.value);
    
    return {
      count: values.length,
      avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      latest: values[values.length - 1].value,
      trend: this.calculateTrend(values.slice(-10)) // Últimas 10 medições
    };
  }

  private calculateTrend(values: Array<{ value: number; timestamp: number }>) {
    if (values.length < 2) return 'stable';
    
    const first = values[0].value;
    const last = values[values.length - 1].value;
    const change = (last - first) / first;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  getAllMetrics() {
    const summary: Record<string, any> = {};
    
    for (const [name, _] of this.metrics) {
      summary[name] = this.getMetricSummary(name);
    }
    
    return summary;
  }
}

// Integration com Sync Engine
export const setupPerformanceMonitoring = (syncEngine: any) => {
  const metrics = new PerformanceMetrics();
  
  // Monitorar duração de sync
  const originalForceSync = syncEngine.forceSync;
  syncEngine.forceSync = async (...args: any[]) => {
    const startTime = Date.now();
    const result = await originalForceSync.apply(syncEngine, args);
    const duration = Date.now() - startTime;
    
    metrics.recordMetric('sync_duration', duration);
    metrics.recordMetric('synced_items', result.syncedItems);
    
    return result;
  };
  
  // Monitorar tamanho da queue
  setInterval(async () => {
    const status = await syncEngine.getStatus();
    metrics.recordMetric('queue_size', status.pendingItems);
    metrics.recordMetric('error_items', status.errorItems);
  }, 30000);
  
  return metrics;
};
```

Com estas ferramentas de logging e diagnóstico, você terá visibilidade completa sobre o comportamento do Sync Engine em produção, permitindo identificar e resolver problemas rapidamente.