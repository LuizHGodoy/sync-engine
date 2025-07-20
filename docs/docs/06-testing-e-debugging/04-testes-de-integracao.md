# Testes de Integração para Sync Engine

Testes de integração verificam se os componentes do Sync Engine funcionam corretamente quando integrados. Este guia apresenta estratégias para testar fluxos completos de sincronização.

## 🎯 Objetivos dos Testes de Integração

### 1. **Fluxo Completo de Sincronização**

- Verificar o ciclo completo: adicionar → queue → sync → servidor
- Testar diferentes estratégias de resolução de conflitos
- Validar comportamento em cenários de erro

### 2. **Integração com Dependências Externas**

- SQLite para persistência
- NetInfo para monitoramento de rede
- Fetch para requisições HTTP

### 3. **Estados de Aplicação Real**

- Múltiplos usuários simultâneos
- Grandes volumes de dados
- Cenários de falha e recuperação

## 🏗️ Setup do Ambiente de Teste

### Configuração Base

```typescript
// __tests__/integration/setup.ts
import { SyncEngineFactory } from "sync-engine-lib";
import { setupTestServer } from "./testServer";
import { setupTestDatabase } from "./testDatabase";

export interface IntegrationTestSetup {
  syncEngine: any;
  testServer: any;
  testDb: any;
  cleanup: () => Promise<void>;
}

export async function setupIntegrationTest(): Promise<IntegrationTestSetup> {
  // Setup test server
  const testServer = setupTestServer();
  await testServer.start();

  // Setup test database
  const testDb = await setupTestDatabase();

  // Create sync engine with test configuration
  const syncEngine = SyncEngineFactory.createForDevelopment(
    `http://localhost:${testServer.port}`,
    {
      debug: true,
      config: {
        syncInterval: 1000, // Sync mais frequente para testes
        batchSize: 10,
        maxRetries: 2,
        initialRetryDelay: 100,
        requestTimeout: 5000,
      },
    }
  );

  await syncEngine.initialize();

  const cleanup = async () => {
    await syncEngine.destroy();
    await testServer.stop();
    await testDb.close();
  };

  return {
    syncEngine,
    testServer,
    testDb,
    cleanup,
  };
}
```

### Test Server Mock

```typescript
// __tests__/integration/testServer.ts
import express from "express";
import { Server } from "http";

export class TestSyncServer {
  private app: express.Application;
  private server: Server | null = null;
  public port: number;

  private data: Map<string, any> = new Map();
  private syncHistory: Array<{
    timestamp: number;
    items: any[];
    result: any;
  }> = [];

  constructor(port: number = 0) {
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.use(express.json({ limit: "10mb" }));

    // Health check
    this.app.get("/health", (req, res) => {
      res.json({ status: "ok", timestamp: Date.now() });
    });

    // Single item sync
    this.app.post("/sync", (req, res) => {
      const item = req.body;
      this.handleSyncItem(item, res);
    });

    // Batch sync
    this.app.post("/sync/batch", (req, res) => {
      const { items } = req.body;
      this.handleBatchSync(items, res);
    });

    // Get all data (for verification)
    this.app.get("/data", (req, res) => {
      const allData = Array.from(this.data.values());
      res.json(allData);
    });

    // Get specific item
    this.app.get("/data/:id", (req, res) => {
      const item = this.data.get(req.params.id);
      if (item) {
        res.json(item);
      } else {
        res.status(404).json({ error: "Item not found" });
      }
    });

    // Clear all data
    this.app.delete("/data", (req, res) => {
      this.data.clear();
      this.syncHistory = [];
      res.json({ message: "Data cleared" });
    });

    // Get sync history
    this.app.get("/sync-history", (req, res) => {
      res.json(this.syncHistory);
    });
  }

  private handleSyncItem(item: any, res: express.Response) {
    try {
      // Simula validação
      if (!item.id || !item.type) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: id, type",
        });
      }

      // Verifica conflitos
      const existingItem = this.data.get(item.id);
      if (existingItem) {
        const conflict = this.detectConflict(existingItem, item);
        if (conflict) {
          return res.json({
            success: false,
            conflicts: [
              {
                id: item.id,
                serverData: existingItem,
                conflictType: conflict.type,
              },
            ],
          });
        }
      }

      // Salva item
      const savedItem = {
        ...item.payload,
        id: item.id,
        type: item.type,
        serverTimestamp: Date.now(),
        version: (existingItem?.version || 0) + 1,
      };

      this.data.set(item.id, savedItem);

      // Registra no histórico
      this.syncHistory.push({
        timestamp: Date.now(),
        items: [item],
        result: { success: true },
      });

      res.json({ success: true, data: savedItem });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private handleBatchSync(items: any[], res: express.Response) {
    try {
      const results = items.map((item) => {
        try {
          // Validação básica
          if (!item.id || !item.type) {
            return {
              id: item.id,
              success: false,
              error: "Missing required fields",
            };
          }

          // Verifica conflitos
          const existingItem = this.data.get(item.id);
          if (existingItem) {
            const conflict = this.detectConflict(existingItem, item);
            if (conflict) {
              return {
                id: item.id,
                success: false,
                conflict: {
                  serverData: existingItem,
                  conflictType: conflict.type,
                },
              };
            }
          }

          // Salva item
          const savedItem = {
            ...item.payload,
            id: item.id,
            type: item.type,
            serverTimestamp: Date.now(),
            version: (existingItem?.version || 0) + 1,
          };

          this.data.set(item.id, savedItem);

          return {
            id: item.id,
            success: true,
            data: savedItem,
          };
        } catch (error) {
          return {
            id: item.id,
            success: false,
            error: error.message,
          };
        }
      });

      // Registra no histórico
      this.syncHistory.push({
        timestamp: Date.now(),
        items,
        result: { success: true, results },
      });

      res.json({
        success: true,
        results,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private detectConflict(serverItem: any, clientItem: any) {
    // Detecta conflito por timestamp
    const serverTime = serverItem.serverTimestamp || serverItem.updatedAt || 0;
    const clientTime = clientItem.timestamp || clientItem.updatedAt || 0;

    if (Math.abs(serverTime - clientTime) < 1000) {
      return { type: "concurrent" };
    }

    // Detecta conflito por versão
    if (serverItem.version && clientItem.version) {
      if (serverItem.version !== clientItem.version) {
        return { type: "version" };
      }
    }

    return null;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (error: any) => {
        if (error) {
          reject(error);
        } else {
          const address = this.server!.address() as any;
          this.port = address.port;
          console.log(`Test server started on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log("Test server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Utilitários para testes
  getData(id: string) {
    return this.data.get(id);
  }

  getAllData() {
    return Array.from(this.data.values());
  }

  getSyncHistory() {
    return [...this.syncHistory];
  }

  clearData() {
    this.data.clear();
    this.syncHistory = [];
  }

  getRequestCount() {
    return this.syncHistory.length;
  }
}

export function setupTestServer(port?: number): TestSyncServer {
  return new TestSyncServer(port);
}
```

## 🧪 Testes de Fluxos Completos

### 1. Teste de Sincronização Básica

```typescript
// __tests__/integration/basicSync.test.ts
import { setupIntegrationTest } from "./setup";

describe("Basic Sync Integration", () => {
  let testSetup: any;

  beforeEach(async () => {
    testSetup = await setupIntegrationTest();
  });

  afterEach(async () => {
    await testSetup.cleanup();
  });

  it("should sync single item successfully", async () => {
    const { syncEngine, testServer } = testSetup;

    // Adiciona item ao queue
    const itemId = "test-item-1";
    const payload = {
      text: "Test todo",
      done: false,
      createdAt: Date.now(),
    };

    await syncEngine.addToQueue(itemId, "todo", payload);

    // Verifica que item está na queue
    const queuedItems = await syncEngine.getQueuedItems();
    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0].id).toBe(itemId);
    expect(queuedItems[0].status).toBe("pending");

    // Força sincronização
    const syncResult = await syncEngine.forceSync();

    // Verifica resultado da sincronização
    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedItems).toBe(1);
    expect(syncResult.errors).toBe(0);

    // Verifica que item foi enviado para o servidor
    const serverData = testServer.getData(itemId);
    expect(serverData).toBeDefined();
    expect(serverData.text).toBe(payload.text);
    expect(serverData.done).toBe(payload.done);

    // Verifica que queue foi limpa
    const finalStatus = await syncEngine.getStatus();
    expect(finalStatus.pendingItems).toBe(0);
  });

  it("should sync multiple items in batch", async () => {
    const { syncEngine, testServer } = testSetup;

    // Adiciona múltiplos items
    const items = [
      { id: "batch-1", payload: { text: "Batch item 1", done: false } },
      { id: "batch-2", payload: { text: "Batch item 2", done: true } },
      { id: "batch-3", payload: { text: "Batch item 3", done: false } },
    ];

    for (const item of items) {
      await syncEngine.addToQueue(item.id, "todo", item.payload);
    }

    // Força sincronização em lote
    const syncResult = await syncEngine.forceSync();

    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedItems).toBe(3);
    expect(syncResult.errors).toBe(0);

    // Verifica que todos os items chegaram ao servidor
    for (const item of items) {
      const serverData = testServer.getData(item.id);
      expect(serverData).toBeDefined();
      expect(serverData.text).toBe(item.payload.text);
      expect(serverData.done).toBe(item.payload.done);
    }

    // Verifica histórico de sync
    const syncHistory = testServer.getSyncHistory();
    expect(syncHistory).toHaveLength(1);
    expect(syncHistory[0].items).toHaveLength(3);
  });

  it("should handle sync errors gracefully", async () => {
    const { syncEngine, testServer } = testSetup;

    // Para o servidor para simular erro
    await testServer.stop();

    // Adiciona item
    await syncEngine.addToQueue("error-item", "todo", { text: "Error test" });

    // Tenta sincronizar (deve falhar)
    await expect(syncEngine.forceSync()).rejects.toThrow();

    // Verifica que item permanece na queue com status de erro
    const status = await syncEngine.getStatus();
    expect(status.errorItems).toBe(1);
    expect(status.pendingItems).toBe(0);

    // Reinicia servidor
    await testServer.start();

    // Tenta novamente (deve funcionar após retry)
    await syncEngine.retryFailedItems();
    const retryResult = await syncEngine.forceSync();

    expect(retryResult.success).toBe(true);
    expect(retryResult.syncedItems).toBe(1);
  });
});
```

### 2. Teste de Resolução de Conflitos

```typescript
// __tests__/integration/conflictResolution.test.ts
import { setupIntegrationTest } from "./setup";
import { ConflictStrategies } from "sync-engine-lib";

describe("Conflict Resolution Integration", () => {
  let testSetup: any;

  beforeEach(async () => {
    testSetup = await setupIntegrationTest();
  });

  afterEach(async () => {
    await testSetup.cleanup();
  });

  it("should resolve conflicts with timestamp strategy", async () => {
    const { syncEngine, testServer } = testSetup;

    // Adiciona item inicial no servidor
    const itemId = "conflict-item";
    const serverItem = {
      id: itemId,
      text: "Server version",
      done: true,
      serverTimestamp: Date.now(),
    };
    testServer.data.set(itemId, serverItem);

    // Configura estratégia de resolução por timestamp
    syncEngine.conflictResolver.setStrategy(ConflictStrategies.timestampWins());

    // Adiciona versão local mais antiga
    const localPayload = {
      text: "Local version",
      done: false,
      updatedAt: Date.now() - 10000, // 10 segundos mais antigo
    };

    await syncEngine.addToQueue(itemId, "todo", localPayload);

    // Força sync (deve detectar conflito)
    const syncResult = await syncEngine.forceSync();

    // Como versão local é mais antiga, deve usar versão do servidor
    const finalServerData = testServer.getData(itemId);
    expect(finalServerData.text).toBe("Server version");
    expect(finalServerData.done).toBe(true);
  });

  it("should resolve conflicts with client wins strategy", async () => {
    const { syncEngine, testServer } = testSetup;

    const itemId = "client-wins-item";

    // Adiciona item no servidor
    testServer.data.set(itemId, {
      id: itemId,
      text: "Server version",
      done: true,
      serverTimestamp: Date.now(),
    });

    // Configura estratégia client wins
    syncEngine.conflictResolver.setStrategy(ConflictStrategies.clientWins());

    // Adiciona versão local
    const localPayload = {
      text: "Client version",
      done: false,
    };

    await syncEngine.addToQueue(itemId, "todo", localPayload);
    await syncEngine.forceSync();

    // Cliente deve ganhar
    const finalServerData = testServer.getData(itemId);
    expect(finalServerData.text).toBe("Client version");
    expect(finalServerData.done).toBe(false);
  });

  it("should handle merge conflicts correctly", async () => {
    const { syncEngine, testServer } = testSetup;

    const itemId = "merge-item";

    // Item no servidor com alguns campos
    testServer.data.set(itemId, {
      id: itemId,
      text: "Server text",
      done: true,
      category: "server-category",
      serverTimestamp: Date.now(),
    });

    // Configura estratégia de merge
    syncEngine.conflictResolver.setStrategy(ConflictStrategies.merge());

    // Versão local com outros campos
    const localPayload = {
      text: "Local text",
      done: false,
      priority: "high",
    };

    await syncEngine.addToQueue(itemId, "todo", localPayload);
    await syncEngine.forceSync();

    // Deve fazer merge (local sobrescreve campos conflitantes)
    const finalServerData = testServer.getData(itemId);
    expect(finalServerData.text).toBe("Local text"); // Local wins
    expect(finalServerData.done).toBe(false); // Local wins
    expect(finalServerData.category).toBe("server-category"); // Servidor mantém
    expect(finalServerData.priority).toBe("high"); // Local adiciona
  });
});
```

### 3. Teste de Conectividade e Estados de Rede

```typescript
// __tests__/integration/networkStates.test.ts
import { setupIntegrationTest } from "./setup";

describe("Network States Integration", () => {
  let testSetup: any;

  beforeEach(async () => {
    testSetup = await setupIntegrationTest();
  });

  afterEach(async () => {
    await testSetup.cleanup();
  });

  it("should queue operations when offline", async () => {
    const { syncEngine } = testSetup;

    // Força modo offline
    syncEngine.setForcedOnline(false);

    // Adiciona items enquanto offline
    await syncEngine.addToQueue("offline-1", "todo", {
      text: "Offline todo 1",
    });
    await syncEngine.addToQueue("offline-2", "todo", {
      text: "Offline todo 2",
    });

    const status = await syncEngine.getStatus();
    expect(status.isOnline).toBe(false);
    expect(status.pendingItems).toBe(2);

    // Sync não deve funcionar offline
    const syncResult = await syncEngine.forceSync();
    expect(syncResult.success).toBe(false);
    expect(syncResult.syncedItems).toBe(0);
  });

  it("should sync when coming back online", async () => {
    const { syncEngine, testServer } = testSetup;

    // Começa offline
    syncEngine.setForcedOnline(false);

    // Adiciona items offline
    await syncEngine.addToQueue("comeback-1", "todo", { text: "Comeback 1" });
    await syncEngine.addToQueue("comeback-2", "todo", { text: "Comeback 2" });

    // Volta online
    syncEngine.setForcedOnline(true);

    // Aguarda um pouco para trigger automático
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verifica que items foram sincronizados
    const finalStatus = await syncEngine.getStatus();
    expect(finalStatus.isOnline).toBe(true);
    expect(finalStatus.pendingItems).toBe(0);

    // Verifica no servidor
    expect(testServer.getData("comeback-1")).toBeDefined();
    expect(testServer.getData("comeback-2")).toBeDefined();
  });

  it("should handle connection interruption during sync", async () => {
    const { syncEngine, testServer } = testSetup;

    // Adiciona muitos items
    for (let i = 0; i < 20; i++) {
      await syncEngine.addToQueue(`interrupt-${i}`, "todo", {
        text: `Interrupt test ${i}`,
      });
    }

    // Inicia sync
    const syncPromise = syncEngine.forceSync();

    // Simula perda de conexão após um tempo
    setTimeout(() => {
      testServer.stop();
    }, 100);

    // Sync deve falhar
    await expect(syncPromise).rejects.toThrow();

    // Verifica que alguns items podem ter sido sincronizados
    const status = await syncEngine.getStatus();
    expect(status.errorItems + status.pendingItems).toBeLessThanOrEqual(20);

    // Reinicia servidor
    await testServer.start();

    // Retry deve funcionar
    await syncEngine.retryFailedItems();
    const retryResult = await syncEngine.forceSync();
    expect(retryResult.success).toBe(true);
  });
});
```

### 4. Teste de Performance e Volume

```typescript
// __tests__/integration/performance.test.ts
import { setupIntegrationTest } from "./setup";

describe("Performance Integration Tests", () => {
  let testSetup: any;

  beforeEach(async () => {
    testSetup = await setupIntegrationTest();
  }, 30000); // Timeout maior para testes de performance

  afterEach(async () => {
    await testSetup.cleanup();
  });

  it("should handle large volume of data efficiently", async () => {
    const { syncEngine, testServer } = testSetup;

    const itemCount = 1000;
    const batchSize = 50;

    console.time("Adding items");

    // Adiciona items em lotes para melhor performance
    for (let batch = 0; batch < itemCount / batchSize; batch++) {
      const promises = [];

      for (let i = 0; i < batchSize; i++) {
        const itemIndex = batch * batchSize + i;
        promises.push(
          syncEngine.addToQueue(`volume-${itemIndex}`, "todo", {
            text: `Volume test item ${itemIndex}`,
            description: "A".repeat(100), // 100 chars
            metadata: {
              category: `cat-${itemIndex % 10}`,
              priority: itemIndex % 5,
            },
          })
        );
      }

      await Promise.all(promises);
    }

    console.timeEnd("Adding items");

    const statusAfterAdd = await syncEngine.getStatus();
    expect(statusAfterAdd.pendingItems).toBe(itemCount);

    console.time("Syncing items");

    // Sync em lotes
    const syncResult = await syncEngine.forceSync();

    console.timeEnd("Syncing items");

    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedItems).toBe(itemCount);
    expect(syncResult.errors).toBe(0);

    // Verifica que todos chegaram ao servidor
    const serverData = testServer.getAllData();
    expect(serverData).toHaveLength(itemCount);

    // Verifica performance
    expect(syncResult.duration).toBeLessThan(30000); // 30 segundos max
  }, 60000);

  it("should maintain performance with concurrent operations", async () => {
    const { syncEngine } = testSetup;

    const operationCount = 100;
    const concurrentBatches = 5;

    console.time("Concurrent operations");

    // Executa operações concorrentes
    const batchPromises = [];

    for (let batch = 0; batch < concurrentBatches; batch++) {
      const batchPromise = async () => {
        for (let i = 0; i < operationCount / concurrentBatches; i++) {
          const itemIndex = batch * (operationCount / concurrentBatches) + i;
          await syncEngine.addToQueue(`concurrent-${itemIndex}`, "todo", {
            text: `Concurrent item ${itemIndex}`,
            batch: batch,
          });
        }
      };

      batchPromises.push(batchPromise());
    }

    await Promise.all(batchPromises);

    console.timeEnd("Concurrent operations");

    const status = await syncEngine.getStatus();
    expect(status.pendingItems).toBe(operationCount);

    // Sync deve funcionar mesmo após operações concorrentes
    const syncResult = await syncEngine.forceSync();
    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedItems).toBe(operationCount);
  }, 30000);

  it("should handle memory efficiently with large datasets", async () => {
    const { syncEngine } = testSetup;

    const initialMemory = process.memoryUsage().heapUsed;
    const rounds = 10;
    const itemsPerRound = 100;

    for (let round = 0; round < rounds; round++) {
      // Adiciona items
      for (let i = 0; i < itemsPerRound; i++) {
        await syncEngine.addToQueue(`memory-${round}-${i}`, "todo", {
          text: `Memory test ${round}-${i}`,
          data: new Array(1000).fill("x").join(""), // ~1KB
        });
      }

      // Sync e limpa
      await syncEngine.forceSync();
      await syncEngine.clearSyncedItems();

      // Força garbage collection se disponível
      if (global.gc) {
        global.gc();
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

    console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);

    // Não deve aumentar mais que 20MB
    expect(memoryIncrease).toBeLessThan(20);
  }, 60000);
});
```

## 🔄 Teste de Estados de Aplicação

### Teste de Ciclo de Vida Completo

```typescript
// __tests__/integration/appLifecycle.test.ts
import { setupIntegrationTest } from "./setup";

describe("App Lifecycle Integration", () => {
  it("should handle complete app lifecycle", async () => {
    // Simula inicialização do app
    let testSetup = await setupIntegrationTest();
    const { syncEngine, testServer } = testSetup;

    // 1. App inicia - adiciona dados iniciais
    await syncEngine.start();
    await syncEngine.addToQueue("lifecycle-1", "todo", {
      text: "Initial todo",
    });
    await syncEngine.forceSync();

    // Verifica que dados foram sincronizados
    expect(testServer.getData("lifecycle-1")).toBeDefined();

    // 2. App vai para background - para sync
    syncEngine.stop();

    // Adiciona dados offline
    await syncEngine.addToQueue("lifecycle-2", "todo", {
      text: "Background todo",
    });

    // 3. App volta para foreground - retoma sync
    await syncEngine.start();

    // Aguarda sync automático
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verifica que dados offline foram sincronizados
    expect(testServer.getData("lifecycle-2")).toBeDefined();

    // 4. App é fechado - cleanup
    await testSetup.cleanup();

    // 5. App é reaberto - nova instância
    testSetup = await setupIntegrationTest();
    const { syncEngine: newSyncEngine } = testSetup;

    await newSyncEngine.initialize();
    await newSyncEngine.start();

    // Dados devem persistir (depende da implementação)
    const status = await newSyncEngine.getStatus();
    console.log("Status após reopening:", status);

    await testSetup.cleanup();
  });
});
```

## 📊 Relatórios de Teste

### Test Reporter Customizado

```typescript
// __tests__/integration/testReporter.ts
export class IntegrationTestReporter {
  private results: Array<{
    testName: string;
    duration: number;
    syncStats: any;
    serverStats: any;
    memoryUsage: any;
    success: boolean;
    error?: string;
  }> = [];

  async recordTest(
    testName: string,
    testFunction: () => Promise<void>,
    syncEngine: any,
    testServer: any
  ) {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      await testFunction();

      const duration = Date.now() - startTime;
      const finalMemory = process.memoryUsage();
      const syncStats = await syncEngine.getStatus();
      const serverStats = {
        requestCount: testServer.getRequestCount(),
        dataCount: testServer.getAllData().length,
      };

      this.results.push({
        testName,
        duration,
        syncStats,
        serverStats,
        memoryUsage: {
          heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
          external: finalMemory.external - initialMemory.external,
        },
        success: true,
      });
    } catch (error) {
      this.results.push({
        testName,
        duration: Date.now() - startTime,
        syncStats: null,
        serverStats: null,
        memoryUsage: null,
        success: false,
        error: error.message,
      });
      throw error;
    }
  }

  generateReport() {
    const totalTests = this.results.length;
    const successfulTests = this.results.filter((r) => r.success).length;
    const averageDuration =
      this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;

    console.log("\n📊 Integration Test Report");
    console.log("=====================================");
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Successful: ${successfulTests}/${totalTests}`);
    console.log(`Average Duration: ${averageDuration.toFixed(2)}ms`);
    console.log("=====================================\n");

    this.results.forEach((result) => {
      const status = result.success ? "✅" : "❌";
      console.log(`${status} ${result.testName} (${result.duration}ms)`);

      if (result.success && result.syncStats) {
        console.log(
          `   Sync: ${result.syncStats.pendingItems} pending, ${result.syncStats.errorItems} errors`
        );
        console.log(
          `   Server: ${result.serverStats.requestCount} requests, ${result.serverStats.dataCount} items`
        );

        if (result.memoryUsage.heapUsed > 1024 * 1024) {
          const memoryMB = (result.memoryUsage.heapUsed / 1024 / 1024).toFixed(
            2
          );
          console.log(`   Memory: +${memoryMB}MB`);
        }
      }

      if (!result.success) {
        console.log(`   Error: ${result.error}`);
      }

      console.log("");
    });
  }

  getResults() {
    return [...this.results];
  }

  clear() {
    this.results = [];
  }
}
```

Os testes de integração são fundamentais para garantir que o Sync Engine funcione corretamente em cenários reais. Eles verificam não apenas a funcionalidade individual dos componentes, mas também como eles trabalham juntos para fornecer uma experiência de sincronização robusta e confiável.
