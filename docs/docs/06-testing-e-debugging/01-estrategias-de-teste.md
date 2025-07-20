# Estratégias de Teste para Apps Offline-First

Testar aplicações offline-first traz desafios únicos. Este guia apresenta estratégias abrangentes para garantir que sua integração com o Sync Engine funcione perfeitamente em todos os cenários.

## 🎯 Tipos de Teste

### 1. **Testes Unitários**

Testam componentes isolados do Sync Engine.

### 2. **Testes de Integração**

Verificam a interação entre componentes e o fluxo completo de sincronização.

### 3. **Testes End-to-End**

Simulam cenários reais de usuário, incluindo mudanças de conectividade.

### 4. **Testes de Stress**

Avaliam o comportamento com grandes volumes de dados e operações.

## 🧪 Configuração do Ambiente de Teste

### Setup Básico com Jest

```typescript
// jest.config.js
module.exports = {
  preset: "react-native",
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  testEnvironment: "node",
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|sync-engine-lib)/)",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/__tests__/**",
  ],
};
```

### Setup File para Mocks

```typescript
// src/__tests__/setup.ts
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
import "react-native-gesture-handler/jestSetup";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

// Mock NetInfo
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock SQLite
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(() =>
    Promise.resolve({
      execAsync: jest.fn(),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      runAsync: jest.fn(),
    })
  ),
}));

// Global test timeout
jest.setTimeout(10000);
```

## 🔬 Testando SyncEngine

### 1. Testes Unitários Básicos

```typescript
// src/__tests__/syncEngine.test.ts
import { SyncEngineFactory, SyncEngineUtils } from "sync-engine-lib";

describe("SyncEngine", () => {
  let syncEngine: any;

  beforeEach(() => {
    syncEngine = SyncEngineFactory.createForDevelopment(
      "http://localhost:3000"
    );
  });

  afterEach(async () => {
    if (syncEngine) {
      await syncEngine.destroy();
    }
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      await expect(syncEngine.initialize()).resolves.not.toThrow();

      const status = await syncEngine.getStatus();
      expect(status.isActive).toBe(false);
      expect(status.isOnline).toBe(true);
    });

    it("should validate configuration correctly", () => {
      const validConfig = SyncEngineUtils.createDefaultConfig(
        "https://api.example.com"
      );
      const validation = SyncEngineUtils.validateConfig(validConfig);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should reject invalid configuration", () => {
      const invalidConfig = SyncEngineUtils.createDefaultConfig("");
      const validation = SyncEngineUtils.validateConfig(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("serverUrl is required");
    });
  });

  describe("Queue Operations", () => {
    beforeEach(async () => {
      await syncEngine.initialize();
    });

    it("should add item to queue", async () => {
      const itemId = SyncEngineUtils.generateId();
      const payload = { text: "Test todo", done: false };

      await syncEngine.addToQueue(itemId, "todo", payload);

      const queuedItems = await syncEngine.getQueuedItems();
      expect(queuedItems).toHaveLength(1);
      expect(queuedItems[0].id).toBe(itemId);
      expect(queuedItems[0].payload).toEqual(payload);
    });

    it("should handle queue status correctly", async () => {
      const status = await syncEngine.getStatus();

      expect(status).toHaveProperty("pendingItems");
      expect(status).toHaveProperty("errorItems");
      expect(status).toHaveProperty("isOnline");
      expect(status).toHaveProperty("isSyncing");
    });
  });
});
```

### 2. Testando Cenários Offline/Online

```typescript
// src/__tests__/offlineScenarios.test.ts
import NetInfo from "@react-native-community/netinfo";
import { SyncEngineFactory } from "sync-engine-lib";

describe("Offline/Online Scenarios", () => {
  let syncEngine: any;
  const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

  beforeEach(async () => {
    syncEngine = SyncEngineFactory.createForDevelopment(
      "http://localhost:3000"
    );
    await syncEngine.initialize();
  });

  afterEach(async () => {
    await syncEngine.destroy();
  });

  describe("Offline Mode", () => {
    beforeEach(() => {
      // Simula modo offline
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: "none",
        details: null,
      });

      syncEngine.setForcedOnline(false);
    });

    it("should queue operations when offline", async () => {
      const itemId = "offline-item-1";
      const payload = { text: "Offline todo", done: false };

      await syncEngine.addToQueue(itemId, "todo", payload);

      const status = await syncEngine.getStatus();
      expect(status.isOnline).toBe(false);
      expect(status.pendingItems).toBe(1);
    });

    it("should not attempt sync when offline", async () => {
      const syncSpy = jest.spyOn(syncEngine, "forceSync");

      await syncEngine.addToQueue("item-1", "todo", { text: "Test" });

      // Sync should not be attempted in offline mode
      expect(syncSpy).not.toHaveBeenCalled();
    });
  });

  describe("Online Mode", () => {
    beforeEach(() => {
      // Simula modo online
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
        details: { isConnectionExpensive: false },
      });

      syncEngine.setForcedOnline(true);
    });

    it("should attempt sync when coming back online", async () => {
      // Primeiro, adiciona item offline
      syncEngine.setForcedOnline(false);
      await syncEngine.addToQueue("item-1", "todo", { text: "Test" });

      // Depois volta online
      syncEngine.setForcedOnline(true);

      const syncSpy = jest.spyOn(syncEngine, "forceSync");
      await syncEngine.start();

      expect(syncSpy).toHaveBeenCalled();
    });
  });

  describe("Connection State Changes", () => {
    it("should handle network state transitions", async () => {
      const connectionListener = jest.fn();
      syncEngine.addEventListener(connectionListener, ["connection_changed"]);

      // Simula mudança de conectividade
      const mockListener = mockNetInfo.addEventListener.mock.calls[0][0];

      // Vai para offline
      mockListener({
        isConnected: false,
        isInternetReachable: false,
        type: "none",
        details: null,
      });

      // Volta para online
      mockListener({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
        details: { isConnectionExpensive: false },
      });

      expect(connectionListener).toHaveBeenCalledTimes(2);
    });
  });
});
```

### 3. Testando Resolução de Conflitos

```typescript
// src/__tests__/conflictResolution.test.ts
import { ConflictStrategies, ConflictUtils } from "sync-engine-lib";

describe("Conflict Resolution", () => {
  describe("ConflictStrategies", () => {
    const localItem = {
      id: "item-1",
      type: "todo",
      payload: { text: "Local version", done: false, updatedAt: 1000 },
      status: "pending" as const,
      retries: 0,
      createdAt: 1000,
      updatedAt: 1000,
    };

    const serverItem = {
      text: "Server version",
      done: true,
      updatedAt: 2000,
    };

    it("should resolve with client wins strategy", async () => {
      const strategy = ConflictStrategies.clientWins();
      const result = await strategy.resolve(localItem, serverItem);

      expect(result.payload.text).toBe("Local version");
      expect(result.payload.done).toBe(false);
    });

    it("should resolve with server wins strategy", async () => {
      const strategy = ConflictStrategies.serverWins();
      const result = await strategy.resolve(localItem, serverItem);

      expect(result.payload.text).toBe("Server version");
      expect(result.payload.done).toBe(true);
    });

    it("should resolve with timestamp wins strategy", async () => {
      const strategy = ConflictStrategies.timestampWins();
      const result = await strategy.resolve(localItem, serverItem);

      // Server tem timestamp mais recente (2000 > 1000)
      expect(result.payload.text).toBe("Server version");
      expect(result.payload.done).toBe(true);
    });

    it("should merge conflicts correctly", async () => {
      const strategy = ConflictStrategies.merge();
      const result = await strategy.resolve(localItem, serverItem);

      // Merge deve combinar campos
      expect(result.payload).toEqual(
        expect.objectContaining({
          text: "Local version", // Local sobrescreve
          done: false, // Local sobrescreve
          updatedAt: expect.any(Number),
        })
      );
    });
  });

  describe("ConflictUtils", () => {
    const localItem = {
      id: "item-1",
      type: "todo",
      payload: { text: "Local", done: false, updatedAt: 1000 },
      status: "pending" as const,
      retries: 0,
      createdAt: 1000,
      updatedAt: 1000,
    };

    it("should detect significant changes", () => {
      const serverItem = { text: "Server", done: true, updatedAt: 2000 };

      const hasChanges = ConflictUtils.hasSignificantChanges(
        localItem,
        serverItem,
        ["updatedAt"] // Ignora timestamp
      );

      expect(hasChanges).toBe(true);
    });

    it("should identify conflict types", () => {
      const serverItem = { text: "Server", version: 2, updatedAt: 2000 };

      const conflictType = ConflictUtils.identifyConflictType(
        localItem,
        serverItem
      );
      expect(["version", "concurrent", "field"]).toContain(conflictType);
    });

    it("should create diff reports", () => {
      const serverItem = { text: "Server", done: true, newField: "value" };

      const diff = ConflictUtils.createDiffReport(localItem, serverItem);

      expect(diff.changedFields).toContain("text");
      expect(diff.changedFields).toContain("done");
      expect(diff.onlyInServer).toContain("newField");
    });
  });
});
```

## 🎭 Mocking e Simulação

### Mock de Servidor para Testes

```typescript
// src/__tests__/mocks/mockServer.ts
export class MockSyncServer {
  private data: Map<string, any> = new Map();
  private shouldFail: boolean = false;
  private delay: number = 0;

  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
  }

  setDelay(ms: number) {
    this.delay = ms;
  }

  async handleSync(items: any[]): Promise<any> {
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    if (this.shouldFail) {
      throw new Error("Mock server error");
    }

    const results = items.map((item) => {
      this.data.set(item.id, item);
      return {
        id: item.id,
        success: true,
      };
    });

    return {
      success: true,
      results,
    };
  }

  getData(id: string) {
    return this.data.get(id);
  }

  clear() {
    this.data.clear();
  }
}
```

### Utilizando Mock em Testes

```typescript
// src/__tests__/integration.test.ts
import { MockSyncServer } from "./mocks/mockServer";

describe("Integration Tests", () => {
  let mockServer: MockSyncServer;
  let syncEngine: any;

  beforeEach(async () => {
    mockServer = new MockSyncServer();

    // Mock fetch para usar o servidor simulado
    global.fetch = jest.fn().mockImplementation(async (url, options) => {
      if (url.includes("/sync")) {
        const body = JSON.parse(options.body);
        const result = await mockServer.handleSync(body.items || [body]);

        return {
          ok: true,
          json: async () => result,
        };
      }

      return { ok: false, status: 404 };
    });

    syncEngine = SyncEngineFactory.createForDevelopment("http://mock-server");
    await syncEngine.initialize();
  });

  afterEach(async () => {
    await syncEngine.destroy();
    mockServer.clear();
  });

  it("should sync successfully with mock server", async () => {
    const itemId = "test-item-1";
    const payload = { text: "Test todo", done: false };

    await syncEngine.addToQueue(itemId, "todo", payload);
    await syncEngine.forceSync();

    const status = await syncEngine.getStatus();
    expect(status.pendingItems).toBe(0);

    // Verifica se dados chegaram no "servidor"
    const serverData = mockServer.getData(itemId);
    expect(serverData.payload).toEqual(payload);
  });

  it("should handle server errors gracefully", async () => {
    mockServer.setShouldFail(true);

    await syncEngine.addToQueue("error-item", "todo", { text: "Error test" });

    // Sync deve falhar mas não quebrar o app
    await expect(syncEngine.forceSync()).rejects.toThrow();

    const status = await syncEngine.getStatus();
    expect(status.errorItems).toBe(1);
  });

  it("should handle slow server responses", async () => {
    mockServer.setDelay(2000); // 2 segundos de delay

    await syncEngine.addToQueue("slow-item", "todo", { text: "Slow test" });

    const startTime = Date.now();
    await syncEngine.forceSync();
    const endTime = Date.now();

    expect(endTime - startTime).toBeGreaterThan(1500);
  });
});
```

## 🎯 Testes de Performance

```typescript
// src/__tests__/performance.test.ts
describe("Performance Tests", () => {
  let syncEngine: any;

  beforeEach(async () => {
    syncEngine = SyncEngineFactory.createForDevelopment(
      "http://localhost:3000"
    );
    await syncEngine.initialize();
  });

  afterEach(async () => {
    await syncEngine.destroy();
  });

  it("should handle large number of queue operations efficiently", async () => {
    const itemCount = 1000;
    const startTime = Date.now();

    // Adiciona muitos items
    const promises = [];
    for (let i = 0; i < itemCount; i++) {
      promises.push(
        syncEngine.addToQueue(`item-${i}`, "todo", {
          text: `Todo ${i}`,
          done: false,
        })
      );
    }

    await Promise.all(promises);
    const endTime = Date.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(5000); // Deve levar menos de 5 segundos

    const status = await syncEngine.getStatus();
    expect(status.pendingItems).toBe(itemCount);
  });

  it("should maintain memory usage within bounds", async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Simula uso intenso
    for (let batch = 0; batch < 10; batch++) {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          syncEngine.addToQueue(`batch-${batch}-item-${i}`, "todo", {
            text: `Batch ${batch} Todo ${i}`,
            data: new Array(1000).fill("x").join(""), // ~1KB por item
          })
        );
      }
      await Promise.all(promises);

      // Força limpeza de items sincronizados
      await syncEngine.clearSyncedItems();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Não deve aumentar mais que 50MB
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});
```

## 🔧 Ferramentas de Debug

### Custom Test Utilities

```typescript
// src/__tests__/utils/testUtils.ts
export const TestUtils = {
  // Aguarda até condição ser verdadeira
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  },

  // Cria payload de teste padronizado
  createTestTodo(id: string, overrides: any = {}) {
    return {
      id,
      text: `Test todo ${id}`,
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    };
  },

  // Simula cenários de rede
  simulateNetworkConditions(
    syncEngine: any,
    condition: "online" | "offline" | "slow"
  ) {
    switch (condition) {
      case "offline":
        syncEngine.setForcedOnline(false);
        break;
      case "online":
        syncEngine.setForcedOnline(true);
        break;
      case "slow":
        // Mock fetch com delay
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockImplementation(async (...args) => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return originalFetch(...args);
        });
        break;
    }
  },

  // Valida estrutura de evento
  validateSyncEvent(event: any, expectedType: string) {
    expect(event).toHaveProperty("type", expectedType);
    expect(event).toHaveProperty("timestamp");
    expect(typeof event.timestamp).toBe("number");
  },
};
```

## 📊 Cobertura de Testes

### Configuração de Coverage

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --coverage --watchAll=false"
  },
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.{ts,tsx}",
      "!src/**/*.d.ts",
      "!src/__tests__/**",
      "!src/**/index.ts"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## 🎯 Melhores Práticas

### 1. **Isolamento de Testes**

- Cada teste deve ser independente
- Use `beforeEach` e `afterEach` para setup/cleanup
- Não compartilhe estado entre testes

### 2. **Nomes Descritivos**

```typescript
// ✅ Bom
it("should queue operations when offline and sync when back online");

// ❌ Ruim
it("should work correctly");
```

### 3. **Teste Cenários Reais**

- Simule condições de rede reais
- Teste com dados de tamanhos variados
- Inclua cenários de erro

### 4. **Asserções Específicas**

```typescript
// ✅ Bom
expect(result.pendingItems).toBe(3);
expect(result.errors).toHaveLength(0);

// ❌ Ruim
expect(result).toBeTruthy();
```

### 5. **Cleanup Adequado**

```typescript
afterEach(async () => {
  if (syncEngine) {
    await syncEngine.destroy();
  }
  jest.clearAllMocks();
});
```

## 🚀 Próximos Passos

1. **Execute os testes**: `npm run test:coverage`
2. **Analise a cobertura**: Identifique gaps de teste
3. **Adicione testes E2E**: Para fluxos completos de usuário
4. **Configure CI/CD**: Para execução automática de testes

Este guia fornece uma base sólida para testar aplicações offline-first. Adapte os exemplos conforme suas necessidades específicas e continue expandindo a suíte de testes conforme adiciona novas funcionalidades.
