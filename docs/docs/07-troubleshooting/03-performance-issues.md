# Problemas de Performance

Performance inadequada pode tornar aplicações offline-first praticamente inutilizáveis. Este guia aborda identificação, diagnóstico e resolução de problemas de performance no Sync Engine.

## 🐌 Identificando Problemas de Performance

### Sinais de Performance Inadequada

#### 1. **Sincronização Lenta**
- Sync demora mais de 30 segundos para poucos items
- Timeout de rede frequentes
- App fica travado durante sync

#### 2. **Queue Operations Lentas**
- `addToQueue()` demora mais de 100ms
- Lag visível na interface durante operações de queue
- Crescimento descontrolado da queue

#### 3. **Alto Uso de Memória**
- Consumo de RAM cresce continuamente
- App é terminado pelo sistema (iOS/Android)
- Vazamentos de memória detectados

#### 4. **Degradação Gradual**
- Performance piora com o tempo de uso
- Operações ficam mais lentas após muitas sincronizações
- Database cresce indefinidamente

## 📊 Ferramentas de Diagnóstico

### 1. Performance Monitor

```typescript
// utils/performanceMonitor.ts
export class SyncPerformanceMonitor {
  private metrics: Map<string, Array<{
    duration: number;
    timestamp: number;
    data?: any;
  }>> = new Map();
  
  private memorySnapshots: Array<{
    timestamp: number;
    heapUsed: number;
    rss: number;
  }> = [];

  startTimer(operationName: string): string {
    const timerId = `${operationName}-${Date.now()}-${Math.random()}`;
    this.recordMetric(`${operationName}_start`, 0, { timerId });
    return timerId;
  }

  endTimer(operationName: string, timerId: string, additionalData?: any) {
    const startMetrics = this.metrics.get(`${operationName}_start`) || [];
    const startMetric = startMetrics.find(m => m.data?.timerId === timerId);
    
    if (startMetric) {
      const duration = Date.now() - startMetric.timestamp;
      this.recordMetric(operationName, duration, additionalData);
      
      // Log operações lentas
      if (duration > this.getThreshold(operationName)) {
        console.warn(`🐌 Slow operation detected: ${operationName} took ${duration}ms`);
        this.analyzeSlowOperation(operationName, duration, additionalData);
      }
    }
  }

  private getThreshold(operationName: string): number {
    const thresholds: Record<string, number> = {
      'addToQueue': 100,
      'forceSync': 30000,
      'getQueuedItems': 500,
      'clearSyncedItems': 1000,
      'conflictResolution': 2000
    };
    return thresholds[operationName] || 1000;
  }

  recordMetric(name: string, duration: number, data?: any) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push({
      duration,
      timestamp: Date.now(),
      data
    });

    // Manter apenas últimas 100 medições
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  recordMemorySnapshot() {
    const memUsage = process.memoryUsage();
    this.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      rss: memUsage.rss
    });

    // Manter apenas últimas 50 snapshots
    if (this.memorySnapshots.length > 50) {
      this.memorySnapshots.shift();
    }
  }

  getPerformanceReport(): {
    slowOperations: Array<{ operation: string; avgDuration: number; count: number }>;
    memoryTrend: 'increasing' | 'stable' | 'decreasing';
    recommendations: string[];
  } {
    const slowOps = this.identifySlowOperations();
    const memTrend = this.analyzeMemoryTrend();
    const recommendations = this.generateRecommendations(slowOps, memTrend);

    return {
      slowOperations: slowOps,
      memoryTrend: memTrend,
      recommendations
    };
  }

  private identifySlowOperations() {
    const operations = [];
    
    for (const [name, metrics] of this.metrics) {
      if (name.endsWith('_start')) continue;
      
      const threshold = this.getThreshold(name);
      const slowMetrics = metrics.filter(m => m.duration > threshold);
      
      if (slowMetrics.length > 0) {
        const avgDuration = slowMetrics.reduce((sum, m) => sum + m.duration, 0) / slowMetrics.length;
        operations.push({
          operation: name,
          avgDuration,
          count: slowMetrics.length
        });
      }
    }

    return operations.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  private analyzeMemoryTrend(): 'increasing' | 'stable' | 'decreasing' {
    if (this.memorySnapshots.length < 5) return 'stable';

    const recent = this.memorySnapshots.slice(-5);
    const first = recent[0].heapUsed;
    const last = recent[recent.length - 1].heapUsed;
    
    const change = (last - first) / first;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private generateRecommendations(slowOps: any[], memTrend: string): string[] {
    const recommendations = [];

    // Recomendações baseadas em operações lentas
    slowOps.forEach(op => {
      switch (op.operation) {
        case 'addToQueue':
          recommendations.push('Consider reducing payload size or implementing batch operations for queue additions');
          break;
        case 'forceSync':
          recommendations.push('Optimize sync performance by reducing batch size or implementing progressive sync');
          break;
        case 'getQueuedItems':
          recommendations.push('Database query optimization needed. Consider adding indexes or limiting query results');
          break;
      }
    });

    // Recomendações baseadas em memória
    if (memTrend === 'increasing') {
      recommendations.push('Memory usage is increasing. Check for memory leaks and implement proper cleanup');
    }

    return recommendations;
  }

  private analyzeSlowOperation(operationName: string, duration: number, data?: any) {
    console.log(`🔍 Analyzing slow operation: ${operationName}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    
    if (data) {
      // Analisa dados específicos da operação
      if (operationName === 'forceSync' && data.itemCount) {
        const msPerItem = duration / data.itemCount;
        console.log(`📊 ${msPerItem.toFixed(2)}ms per item`);
        
        if (msPerItem > 1000) {
          console.warn('⚠️ Very slow sync per item. Check server performance and network latency');
        }
      }
      
      if (operationName === 'addToQueue' && data.payloadSize) {
        const msPerByte = duration / data.payloadSize;
        console.log(`📦 ${(msPerByte * 1000).toFixed(2)}ms per KB`);
        
        if (msPerByte > 0.1) {
          console.warn('⚠️ Slow database writes. Consider optimizing SQLite operations');
        }
      }
    }
  }
}
```

### 2. Instrumentação do Sync Engine

```typescript
// utils/syncInstrumentation.ts
export class SyncEngineInstrumentation {
  private monitor: SyncPerformanceMonitor;
  private syncEngine: any;

  constructor(syncEngine: any) {
    this.monitor = new SyncPerformanceMonitor();
    this.syncEngine = syncEngine;
    this.instrumentMethods();
    this.setupPeriodicMonitoring();
  }

  private instrumentMethods() {
    // Instrumentar addToQueue
    const originalAddToQueue = this.syncEngine.addToQueue;
    this.syncEngine.addToQueue = async (...args: any[]) => {
      const timerId = this.monitor.startTimer('addToQueue');
      const payloadSize = JSON.stringify(args[2] || {}).length;
      
      try {
        const result = await originalAddToQueue.apply(this.syncEngine, args);
        this.monitor.endTimer('addToQueue', timerId, { payloadSize });
        return result;
      } catch (error) {
        this.monitor.endTimer('addToQueue', timerId, { payloadSize, error: true });
        throw error;
      }
    };

    // Instrumentar forceSync
    const originalForceSync = this.syncEngine.forceSync;
    this.syncEngine.forceSync = async (...args: any[]) => {
      const timerId = this.monitor.startTimer('forceSync');
      
      try {
        const queueItems = await this.syncEngine.getQueuedItems();
        const itemCount = queueItems.length;
        
        const result = await originalForceSync.apply(this.syncEngine, args);
        
        this.monitor.endTimer('forceSync', timerId, {
          itemCount,
          syncedItems: result.syncedItems,
          errors: result.errors
        });
        
        return result;
      } catch (error) {
        this.monitor.endTimer('forceSync', timerId, { error: true });
        throw error;
      }
    };

    // Instrumentar getQueuedItems
    const originalGetQueuedItems = this.syncEngine.getQueuedItems;
    this.syncEngine.getQueuedItems = async (...args: any[]) => {
      const timerId = this.monitor.startTimer('getQueuedItems');
      
      try {
        const result = await originalGetQueuedItems.apply(this.syncEngine, args);
        this.monitor.endTimer('getQueuedItems', timerId, { itemCount: result.length });
        return result;
      } catch (error) {
        this.monitor.endTimer('getQueuedItems', timerId, { error: true });
        throw error;
      }
    };
  }

  private setupPeriodicMonitoring() {
    // Monitorar memória a cada 30 segundos
    setInterval(() => {
      this.monitor.recordMemorySnapshot();
    }, 30000);

    // Relatório de performance a cada 5 minutos
    setInterval(() => {
      const report = this.monitor.getPerformanceReport();
      
      if (report.slowOperations.length > 0 || report.memoryTrend === 'increasing') {
        console.warn('📊 Performance Alert!');
        console.warn('Slow Operations:', report.slowOperations);
        console.warn('Memory Trend:', report.memoryTrend);
        console.warn('Recommendations:', report.recommendations);
      }
    }, 5 * 60 * 1000);
  }

  getPerformanceReport() {
    return this.monitor.getPerformanceReport();
  }

  exportMetrics() {
    return {
      timestamp: Date.now(),
      performance: this.monitor.getPerformanceReport(),
      // Adicionar outras métricas conforme necessário
    };
  }
}
```

## 🚀 Otimizações Específicas

### 1. Otimização de Queue Operations

#### Problema: `addToQueue()` Lento

```typescript
// ❌ Implementação ineficiente
class SlowQueueManager {
  async addToQueue(id: string, type: string, payload: any) {
    // Validação demorada
    await this.validatePayload(payload);
    
    // Insert sem batch
    await this.db.runAsync(
      'INSERT INTO outbox (id, type, data, status) VALUES (?, ?, ?, ?)',
      [id, type, JSON.stringify(payload), 'pending']
    );
    
    // Reindex toda vez
    await this.reindexQueue();
    
    // Trigger sync imediato
    await this.triggerSync();
  }
}

// ✅ Implementação otimizada
class OptimizedQueueManager {
  private batchBuffer: Array<{ id: string; type: string; payload: any }> = [];
  private batchTimeout?: NodeJS.Timeout;

  async addToQueue(id: string, type: string, payload: any) {
    // Validação leve/assíncrona
    this.validatePayloadAsync(payload);
    
    // Adicionar ao buffer para batch
    this.batchBuffer.push({ id, type, payload });
    
    if (this.batchBuffer.length >= 10) {
      // Flush imediato se buffer cheio
      await this.flushBatch();
    } else {
      // Agendaflush após delay
      this.scheduleBatchFlush();
    }
  }

  private scheduleBatchFlush() {
    if (this.batchTimeout) return;
    
    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, 100); // 100ms delay
  }

  private async flushBatch() {
    if (this.batchBuffer.length === 0) return;
    
    const items = [...this.batchBuffer];
    this.batchBuffer = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = undefined;
    }

    // Insert em batch
    await this.db.runAsync('BEGIN TRANSACTION');
    
    try {
      for (const item of items) {
        await this.db.runAsync(
          'INSERT INTO outbox (id, type, data, status, created_at) VALUES (?, ?, ?, ?, ?)',
          [item.id, item.type, JSON.stringify(item.payload), 'pending', Date.now()]
        );
      }
      
      await this.db.runAsync('COMMIT');
      
      // Trigger sync com debounce
      this.debouncedTriggerSync();
    } catch (error) {
      await this.db.runAsync('ROLLBACK');
      throw error;
    }
  }

  private debouncedTriggerSync = debounce(() => {
    this.triggerSync();
  }, 1000);
}
```

#### Problema: Queries SQLite Lentas

```typescript
// ❌ Query ineficiente
async getQueuedItems() {
  return await this.db.getAllAsync(`
    SELECT * FROM outbox 
    WHERE status = 'pending' 
    ORDER BY created_at ASC
  `);
}

// ✅ Query otimizada
async getQueuedItems(limit: number = 100) {
  // Usar índices
  return await this.db.getAllAsync(`
    SELECT id, type, data, status, retry_count, created_at 
    FROM outbox 
    WHERE status = 'pending' 
    ORDER BY created_at ASC 
    LIMIT ?
  `, [limit]);
}

// ✅ Criar índices apropriados
async createIndexes() {
  await this.db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
    CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox(created_at);
    CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox(status, created_at);
  `);
}
```

### 2. Otimização de Sincronização

#### Problema: Sync Muito Lento

```typescript
// ❌ Sincronização ineficiente
class SlowSyncEngine {
  async forceSync() {
    const items = await this.getQueuedItems(); // Todos os items
    
    // Sync um por vez
    for (const item of items) {
      try {
        await this.syncSingleItem(item);
        await this.markAsSynced(item.id);
      } catch (error) {
        await this.markAsError(item.id, error);
      }
    }
  }
}

// ✅ Sincronização otimizada
class OptimizedSyncEngine {
  private readonly DEFAULT_BATCH_SIZE = 25;
  private readonly MAX_CONCURRENT_BATCHES = 3;

  async forceSync() {
    const items = await this.getQueuedItems(this.DEFAULT_BATCH_SIZE * this.MAX_CONCURRENT_BATCHES);
    
    if (items.length === 0) return { success: true, syncedItems: 0, errors: 0 };

    // Dividir em batches
    const batches = this.chunkArray(items, this.DEFAULT_BATCH_SIZE);
    
    // Processar batches concorrentemente
    const results = await Promise.allSettled(
      batches.map(batch => this.syncBatch(batch))
    );

    return this.aggregateResults(results);
  }

  private async syncBatch(items: any[]) {
    try {
      // Sync em lote para o servidor
      const response = await this.sendBatchToServer(items);
      
      // Processar respostas
      await this.processBatchResponse(items, response);
      
      return { success: true, syncedItems: items.length, errors: 0 };
    } catch (error) {
      // Fallback: tentar items individualmente
      return await this.fallbackIndividualSync(items);
    }
  }

  private async sendBatchToServer(items: any[]) {
    const payload = {
      items: items.map(item => ({
        id: item.id,
        type: item.type,
        payload: JSON.parse(item.data),
        timestamp: item.created_at
      }))
    };

    const response = await fetch(`${this.config.serverUrl}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify(payload),
      timeout: this.config.requestTimeout
    });

    if (!response.ok) {
      throw new Error(`Batch sync failed: ${response.status}`);
    }

    return await response.json();
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

#### Problema: Payloads Muito Grandes

```typescript
// ❌ Payload gigante
await syncEngine.addToQueue('item-1', 'document', {
  text: 'Document content...',
  images: [base64Image1, base64Image2, base64Image3], // 10MB+ cada
  attachments: [largeFile1, largeFile2] // Arquivos binários
});

// ✅ Estratégia otimizada
class OptimizedPayloadManager {
  async addDocumentToQueue(id: string, document: any) {
    // 1. Separar assets grandes
    const { assets, lightDocument } = this.extractAssets(document);
    
    // 2. Upload assets separadamente
    const assetUrls = await this.uploadAssets(assets);
    
    // 3. Adicionar apenas referências na queue
    await syncEngine.addToQueue(id, 'document', {
      ...lightDocument,
      assetUrls // Apenas URLs, não conteúdo
    });
  }

  private extractAssets(document: any) {
    const assets: Array<{ id: string; data: string; type: string }> = [];
    const lightDocument = { ...document };

    // Extrair imagens
    if (document.images) {
      lightDocument.imageIds = [];
      document.images.forEach((imageData: string, index: number) => {
        const assetId = `${document.id}-image-${index}`;
        assets.push({ id: assetId, data: imageData, type: 'image' });
        lightDocument.imageIds.push(assetId);
      });
      delete lightDocument.images;
    }

    // Extrair anexos
    if (document.attachments) {
      lightDocument.attachmentIds = [];
      document.attachments.forEach((attachment: any, index: number) => {
        const assetId = `${document.id}-attachment-${index}`;
        assets.push({ id: assetId, data: attachment.data, type: 'attachment' });
        lightDocument.attachmentIds.push(assetId);
      });
      delete lightDocument.attachments;
    }

    return { assets, lightDocument };
  }

  private async uploadAssets(assets: any[]): Promise<string[]> {
    const uploadPromises = assets.map(async (asset) => {
      // Upload para CDN/storage
      const response = await fetch(`${this.config.assetUploadUrl}`, {
        method: 'POST',
        body: this.createAssetFormData(asset)
      });

      if (!response.ok) {
        throw new Error(`Asset upload failed: ${asset.id}`);
      }

      const result = await response.json();
      return result.url;
    });

    return await Promise.all(uploadPromises);
  }
}
```

### 3. Otimização de Memória

#### Problema: Vazamentos de Memória

```typescript
// ❌ Código com vazamentos
class LeakyQueueManager {
  private allItems: any[] = []; // Cresce indefinidamente
  private listeners: any[] = []; // Nunca limpos

  async addToQueue(item: any) {
    this.allItems.push(item); // Nunca remove
    
    // Event listeners não são limpos
    this.eventEmitter.on('sync', () => {
      // Closure captura this.allItems
      console.log(`Total items: ${this.allItems.length}`);
    });
  }
}

// ✅ Código otimizado para memória
class MemoryEfficientQueueManager {
  private readonly MAX_MEMORY_ITEMS = 1000;
  private recentItems: LRU<string, any>; // LRU cache
  private eventListeners: Set<() => void> = new Set();

  constructor() {
    this.recentItems = new LRU(this.MAX_MEMORY_ITEMS);
    this.setupPeriodicCleanup();
  }

  async addToQueue(item: any) {
    // Usar LRU cache em vez de array infinito
    this.recentItems.set(item.id, item);
    
    // Cleanup automático de listeners
    const listener = () => {
      console.log(`Queue size: ${this.recentItems.size}`);
    };
    
    this.eventListeners.add(listener);
    this.eventEmitter.once('sync', listener); // Use 'once' quando possível
  }

  private setupPeriodicCleanup() {
    setInterval(() => {
      this.cleanupMemory();
    }, 5 * 60 * 1000); // A cada 5 minutos
  }

  private cleanupMemory() {
    // Forçar garbage collection se disponível
    if (global.gc) {
      global.gc();
    }

    // Limpar listeners órfãos
    this.eventListeners.forEach(listener => {
      this.eventEmitter.removeListener('sync', listener);
    });
    this.eventListeners.clear();

    // Limpar cache se muito grande
    if (this.recentItems.size > this.MAX_MEMORY_ITEMS * 0.8) {
      this.recentItems.clear();
    }
  }

  destroy() {
    // Cleanup explícito
    this.recentItems.clear();
    this.eventListeners.clear();
    this.eventEmitter.removeAllListeners();
  }
}
```

#### Problema: Database Cresce Indefinidamente

```typescript
// ✅ Limpeza automática da database
class DatabaseMaintenanceManager {
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas
  private readonly MAX_SYNCED_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias
  private readonly MAX_ERROR_AGE = 30 * 24 * 60 * 60 * 1000; // 30 dias

  constructor(private db: any) {
    this.schedulePeriodicCleanup();
  }

  private schedulePeriodicCleanup() {
    setInterval(() => {
      this.performMaintenance();
    }, this.CLEANUP_INTERVAL);
  }

  async performMaintenance() {
    console.log('🧹 Starting database maintenance...');
    
    try {
      await this.cleanupSyncedItems();
      await this.cleanupOldErrors();
      await this.optimizeDatabase();
      await this.compactDatabase();
      
      console.log('✅ Database maintenance completed');
    } catch (error) {
      console.error('❌ Database maintenance failed:', error);
    }
  }

  private async cleanupSyncedItems() {
    const cutoff = Date.now() - this.MAX_SYNCED_AGE;
    
    const result = await this.db.runAsync(`
      DELETE FROM outbox 
      WHERE status = 'synced' 
      AND updated_at < ?
    `, [cutoff]);

    console.log(`🗑️ Cleaned up ${result.changes} old synced items`);
  }

  private async cleanupOldErrors() {
    const cutoff = Date.now() - this.MAX_ERROR_AGE;
    
    const result = await this.db.runAsync(`
      DELETE FROM outbox 
      WHERE status = 'error' 
      AND retry_count >= ? 
      AND updated_at < ?
    `, [this.maxRetries, cutoff]);

    console.log(`🗑️ Cleaned up ${result.changes} old error items`);
  }

  private async optimizeDatabase() {
    // Recriar índices se necessário
    await this.db.execAsync('ANALYZE');
    
    // Estatísticas de uso
    const stats = await this.getDatabaseStats();
    console.log('📊 Database stats:', stats);
  }

  private async compactDatabase() {
    // VACUUM para recuperar espaço
    await this.db.execAsync('VACUUM');
    console.log('🗜️ Database compacted');
  }

  private async getDatabaseStats() {
    const tables = await this.db.getAllAsync(`
      SELECT name, 
             (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as table_count
      FROM sqlite_master m WHERE type='table'
    `);

    const sizes = await Promise.all(
      tables.map(async (table) => {
        const count = await this.db.getFirstAsync(
          `SELECT COUNT(*) as count FROM ${table.name}`
        );
        return { table: table.name, rows: count.count };
      })
    );

    return sizes;
  }
}
```

## 🔧 Configurações de Performance

### 1. Configuração Otimizada

```typescript
// ✅ Configuração para alta performance
const performanceConfig = {
  // Sync otimizado
  syncInterval: 30000, // 30 segundos (não muito frequente)
  batchSize: 25, // Tamanho moderado de batch
  maxRetries: 3,
  initialRetryDelay: 1000,
  maxRetryDelay: 10000,
  requestTimeout: 15000,

  // SQLite otimizado
  database: {
    pragma: {
      journal_mode: 'WAL', // Write-Ahead Logging para melhor concorrência
      synchronous: 'NORMAL', // Balance entre performance e durabilidade
      cache_size: -2000, // 2MB cache
      temp_store: 'MEMORY', // Tabelas temporárias em memória
      mmap_size: 67108864, // 64MB memory map
    }
  },

  // Queue otimizada
  queue: {
    maxItems: 1000, // Limitar tamanho da queue
    batchInsertSize: 10,
    indexMaintenanceInterval: 60000, // 1 minuto
    cleanupInterval: 300000, // 5 minutos
  },

  // Memory management
  memory: {
    maxCacheSize: 100, // Items em cache
    gcInterval: 300000, // 5 minutos
    forceGCThreshold: 100 * 1024 * 1024, // 100MB
  }
};
```

### 2. SQLite Performance Tuning

```typescript
// ✅ Otimizações SQLite
export class SQLiteOptimizer {
  async optimizeDatabase(db: any) {
    // Configurar PRAGMA para performance
    await db.execAsync('PRAGMA journal_mode = WAL');
    await db.execAsync('PRAGMA synchronous = NORMAL');
    await db.execAsync('PRAGMA cache_size = -2000'); // 2MB
    await db.execAsync('PRAGMA temp_store = MEMORY');
    await db.execAsync('PRAGMA mmap_size = 67108864'); // 64MB

    // Criar índices otimizados
    await this.createOptimizedIndexes(db);
    
    // Configurar auto_vacuum
    await db.execAsync('PRAGMA auto_vacuum = INCREMENTAL');
  }

  private async createOptimizedIndexes(db: any) {
    // Índices compostos para queries comuns
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_outbox_status_created 
      ON outbox(status, created_at) 
      WHERE status IN ('pending', 'error')
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_outbox_type_status 
      ON outbox(type, status)
    `);

    // Índice parcial para items ativos
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_outbox_active 
      ON outbox(id, updated_at) 
      WHERE status NOT IN ('synced', 'deleted')
    `);
  }

  async analyzePerformance(db: any) {
    // Query plan analysis
    const queryPlan = await db.getAllAsync(`
      EXPLAIN QUERY PLAN 
      SELECT * FROM outbox 
      WHERE status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT 25
    `);

    console.log('📊 Query Plan:', queryPlan);

    // Index usage
    const indexStats = await db.getAllAsync(`
      SELECT name, tbl_name 
      FROM sqlite_master 
      WHERE type = 'index'
    `);

    console.log('📋 Available Indexes:', indexStats);
  }
}
```

## 📊 Monitoramento Contínuo

### Performance Dashboard

```typescript
// components/PerformanceDashboard.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';

interface PerformanceDashboardProps {
  performanceMonitor: SyncPerformanceMonitor;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  performanceMonitor
}) => {
  const [report, setReport] = useState<any>(null);
  const [memoryUsage, setMemoryUsage] = useState<any>(null);

  useEffect(() => {
    const updateMetrics = () => {
      const performanceReport = performanceMonitor.getPerformanceReport();
      setReport(performanceReport);

      // Memory usage
      const memUsage = process.memoryUsage();
      setMemoryUsage({
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        rss: (memUsage.rss / 1024 / 1024).toFixed(2),
        external: (memUsage.external / 1024 / 1024).toFixed(2)
      });
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);
    
    return () => clearInterval(interval);
  }, [performanceMonitor]);

  const getMemoryTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing': return '#ff4444';
      case 'decreasing': return '#44ff44';
      default: return '#ffaa00';
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        Performance Monitor
      </Text>

      {/* Memory Usage */}
      <View style={{ 
        backgroundColor: '#f5f5f5', 
        padding: 12, 
        borderRadius: 8, 
        marginBottom: 16 
      }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
          Memory Usage
        </Text>
        {memoryUsage && (
          <>
            <Text>Heap Used: {memoryUsage.heapUsed} MB</Text>
            <Text>RSS: {memoryUsage.rss} MB</Text>
            <Text>External: {memoryUsage.external} MB</Text>
            {report && (
              <Text style={{ 
                color: getMemoryTrendColor(report.memoryTrend),
                fontWeight: 'bold',
                marginTop: 4
              }}>
                Trend: {report.memoryTrend}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Slow Operations */}
      {report && report.slowOperations.length > 0 && (
        <View style={{ 
          backgroundColor: '#fff3cd', 
          padding: 12, 
          borderRadius: 8, 
          marginBottom: 16 
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
            ⚠️ Slow Operations
          </Text>
          {report.slowOperations.map((op: any, index: number) => (
            <View key={index} style={{ marginBottom: 4 }}>
              <Text style={{ fontWeight: 'bold' }}>{op.operation}</Text>
              <Text>Avg: {op.avgDuration.toFixed(0)}ms ({op.count} times)</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recommendations */}
      {report && report.recommendations.length > 0 && (
        <View style={{ 
          backgroundColor: '#d1ecf1', 
          padding: 12, 
          borderRadius: 8 
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
            💡 Recommendations
          </Text>
          {report.recommendations.map((rec: string, index: number) => (
            <Text key={index} style={{ marginBottom: 4 }}>
              • {rec}
            </Text>
          ))}
        </View>
      )}

      {report && report.slowOperations.length === 0 && (
        <View style={{ 
          backgroundColor: '#d4edda', 
          padding: 12, 
          borderRadius: 8 
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#155724' }}>
            ✅ Performance Normal
          </Text>
          <Text style={{ color: '#155724' }}>
            No performance issues detected
          </Text>
        </View>
      )}
    </ScrollView>
  );
};
```

## 🎯 Checklist de Performance

### ✅ Queue Performance
- [ ] Operações de queue < 100ms
- [ ] Batch inserts implementados
- [ ] Índices SQLite otimizados
- [ ] Limpeza automática configurada

### ✅ Sync Performance  
- [ ] Sync de 100 items < 30 segundos
- [ ] Batch sync implementado
- [ ] Timeouts apropriados configurados
- [ ] Fallback para sync individual

### ✅ Memory Management
- [ ] Uso de memória estável
- [ ] Caches com tamanho limitado
- [ ] Cleanup automático ativo
- [ ] Event listeners limpos

### ✅ Database Performance
- [ ] Queries otimizadas com índices
- [ ] PRAGMA SQLite configurado
- [ ] Vacuum automático agendado
- [ ] Estatísticas monitoradas

### ✅ Payload Optimization
- [ ] Payloads < 50KB por item
- [ ] Assets grandes separados
- [ ] Compressão implementada
- [ ] Chunking para dados grandes

Seguindo estas práticas e usando as ferramentas de diagnóstico, você pode manter o Sync Engine executando com performance otimizada mesmo em aplicações com alto volume de dados e operações.