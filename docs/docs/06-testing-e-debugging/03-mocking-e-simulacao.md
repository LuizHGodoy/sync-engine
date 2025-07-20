# Mocking e Simulação para Testes

Testar aplicações offline-first requer simulação precisa de diferentes cenários de rede, estados de servidor e condições de erro. Este guia apresenta estratégias abrangentes para mocking e simulação.

## 🎭 Estratégias de Mocking

### 1. Mock de Conectividade de Rede

```typescript
// mocks/networkMock.ts
export class NetworkMock {
  private isOnline: boolean = true;
  private listeners: Array<(state: any) => void> = [];
  private connectionType: string = "wifi";
  private isExpensive: boolean = false;

  // Simula mudança de estado de rede
  setOnline(online: boolean) {
    this.isOnline = online;
    this.notifyListeners();
  }

  setConnectionType(type: "wifi" | "cellular" | "ethernet" | "none") {
    this.connectionType = type;
    this.isOnline = type !== "none";
    this.notifyListeners();
  }

  setExpensiveConnection(expensive: boolean) {
    this.isExpensive = expensive;
    this.notifyListeners();
  }

  // Simula instabilidade de rede
  simulateInstability(duration: number = 5000) {
    const originalState = this.isOnline;

    const toggleConnection = () => {
      this.isOnline = !this.isOnline;
      this.notifyListeners();
    };

    const interval = setInterval(toggleConnection, 1000);

    setTimeout(() => {
      clearInterval(interval);
      this.isOnline = originalState;
      this.notifyListeners();
    }, duration);
  }

  private notifyListeners() {
    const state = {
      isConnected: this.isOnline,
      isInternetReachable: this.isOnline,
      type: this.connectionType,
      details: {
        isConnectionExpensive: this.isExpensive,
      },
    };

    this.listeners.forEach((listener) => listener(state));
  }

  // Interface compatível com @react-native-community/netinfo
  fetch() {
    return Promise.resolve({
      isConnected: this.isOnline,
      isInternetReachable: this.isOnline,
      type: this.connectionType,
      details: {
        isConnectionExpensive: this.isExpensive,
      },
    });
  }

  addEventListener(listener: (state: any) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

// Setup global do mock
export const networkMock = new NetworkMock();

// Mock para jest
jest.mock("@react-native-community/netinfo", () => ({
  fetch: () => networkMock.fetch(),
  addEventListener: (listener: any) => networkMock.addEventListener(listener),
}));
```

### 2. Mock de Servidor HTTP

```typescript
// mocks/serverMock.ts
interface MockResponse {
  status: number;
  data?: any;
  delay?: number;
  error?: string;
}

export class HTTPServerMock {
  private routes: Map<string, MockResponse> = new Map();
  private requestHistory: Array<{
    url: string;
    method: string;
    body?: any;
    timestamp: number;
  }> = [];

  private defaultDelay: number = 0;
  private failureRate: number = 0; // 0-1, probabilidade de falha

  // Configurar resposta para rota específica
  mockRoute(method: string, path: string, response: MockResponse) {
    const key = `${method.toUpperCase()}:${path}`;
    this.routes.set(key, response);
  }

  // Configurar delay global
  setDefaultDelay(ms: number) {
    this.defaultDelay = ms;
  }

  // Configurar taxa de falha
  setFailureRate(rate: number) {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  // Simular respostas lentas
  simulateSlowNetwork(enabled: boolean = true) {
    this.setDefaultDelay(enabled ? 2000 : 0);
  }

  // Simular servidor instável
  simulateServerInstability(failureRate: number = 0.3) {
    this.setFailureRate(failureRate);
  }

  // Mock fetch implementation
  async mockFetch(url: string, options: any = {}): Promise<Response> {
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : undefined;

    // Registra requisição
    this.requestHistory.push({
      url,
      method,
      body,
      timestamp: Date.now(),
    });

    // Simula falha aleatória
    if (Math.random() < this.failureRate) {
      throw new Error("Simulated network error");
    }

    // Busca resposta mockada
    const routeKey = `${method.toUpperCase()}:${new URL(url).pathname}`;
    const mockResponse = this.routes.get(routeKey);

    if (!mockResponse) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Aplica delay
    const delay = mockResponse.delay ?? this.defaultDelay;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Simula erro HTTP
    if (mockResponse.error) {
      throw new Error(mockResponse.error);
    }

    // Retorna resposta mockada
    return new Response(JSON.stringify(mockResponse.data || {}), {
      status: mockResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Utilitários para análise
  getRequestHistory() {
    return [...this.requestHistory];
  }

  getRequestCount(method?: string, path?: string) {
    return this.requestHistory.filter((req) => {
      if (method && req.method !== method.toUpperCase()) return false;
      if (path && !req.url.includes(path)) return false;
      return true;
    }).length;
  }

  clearHistory() {
    this.requestHistory = [];
  }

  reset() {
    this.routes.clear();
    this.requestHistory = [];
    this.defaultDelay = 0;
    this.failureRate = 0;
  }
}

// Instância global
export const serverMock = new HTTPServerMock();

// Setup para testes
export const setupServerMock = () => {
  global.fetch = jest
    .fn()
    .mockImplementation(serverMock.mockFetch.bind(serverMock));
};

export const teardownServerMock = () => {
  serverMock.reset();
  jest.restoreAllMocks();
};
```

### 3. Mock de SQLite

```typescript
// mocks/sqliteMock.ts
export class SQLiteMock {
  private tables: Map<string, any[]> = new Map();
  private queryHistory: Array<{
    sql: string;
    params?: any[];
    timestamp: number;
    result?: any;
  }> = [];

  private shouldFail: boolean = false;
  private delay: number = 0;

  constructor() {
    this.initializeTables();
  }

  private initializeTables() {
    // Inicializa tabelas necessárias para o Sync Engine
    this.tables.set("outbox", []);
    this.tables.set("entity_metadata", []);
  }

  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
  }

  setDelay(ms: number) {
    this.delay = ms;
  }

  private async executeWithDelay<T>(operation: () => T): Promise<T> {
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    if (this.shouldFail) {
      throw new Error("Simulated SQLite error");
    }

    return operation();
  }

  private logQuery(sql: string, params?: any[], result?: any) {
    this.queryHistory.push({
      sql,
      params,
      timestamp: Date.now(),
      result,
    });
  }

  // Mock das operações SQLite
  async execAsync(sql: string): Promise<any> {
    return this.executeWithDelay(() => {
      this.logQuery(sql);

      // Simula execução de DDL
      if (sql.includes("CREATE TABLE")) {
        const match = sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
        if (match) {
          const tableName = match[1];
          if (!this.tables.has(tableName)) {
            this.tables.set(tableName, []);
          }
        }
      }

      return { changes: 0, lastInsertRowId: 0 };
    });
  }

  async getAllAsync(sql: string, params?: any[]): Promise<any[]> {
    return this.executeWithDelay(() => {
      const result = this.simulateQuery(sql, params);
      this.logQuery(sql, params, result);
      return result;
    });
  }

  async getFirstAsync(sql: string, params?: any[]): Promise<any> {
    return this.executeWithDelay(() => {
      const results = this.simulateQuery(sql, params);
      const result = results[0] || null;
      this.logQuery(sql, params, result);
      return result;
    });
  }

  async runAsync(sql: string, params?: any[]): Promise<any> {
    return this.executeWithDelay(() => {
      const result = this.simulateModification(sql, params);
      this.logQuery(sql, params, result);
      return result;
    });
  }

  private simulateQuery(sql: string, params?: any[]): any[] {
    const sqlLower = sql.toLowerCase();

    // SELECT simples
    if (sqlLower.includes("select") && sqlLower.includes("from outbox")) {
      const outboxData = this.tables.get("outbox") || [];

      if (sqlLower.includes("where status = ?") && params?.[0] === "pending") {
        return outboxData.filter((item) => item.status === "pending");
      }

      return outboxData;
    }

    if (
      sqlLower.includes("select") &&
      sqlLower.includes("from entity_metadata")
    ) {
      return this.tables.get("entity_metadata") || [];
    }

    return [];
  }

  private simulateModification(sql: string, params?: any[]): any {
    const sqlLower = sql.toLowerCase();

    if (sqlLower.includes("insert into outbox")) {
      const outbox = this.tables.get("outbox") || [];
      const newItem = {
        id: params?.[0] || `mock-${Date.now()}`,
        entity_table: params?.[1] || "test",
        entity_id: params?.[2] || "test-entity",
        operation: params?.[3] || "CREATE",
        data: params?.[4] || "{}",
        status: params?.[5] || "pending",
        retry_count: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      outbox.push(newItem);
      this.tables.set("outbox", outbox);

      return { changes: 1, lastInsertRowId: outbox.length };
    }

    if (sqlLower.includes("update outbox")) {
      const outbox = this.tables.get("outbox") || [];
      let changes = 0;

      if (sqlLower.includes("set status = ?") && params) {
        const newStatus = params[0];
        const itemId = params[1];

        outbox.forEach((item) => {
          if (item.id === itemId) {
            item.status = newStatus;
            item.updated_at = Date.now();
            changes++;
          }
        });
      }

      return { changes };
    }

    if (sqlLower.includes("delete from outbox")) {
      const outbox = this.tables.get("outbox") || [];
      const initialLength = outbox.length;

      if (sqlLower.includes("where status = ?") && params?.[0] === "synced") {
        const filtered = outbox.filter((item) => item.status !== "synced");
        this.tables.set("outbox", filtered);
        return { changes: initialLength - filtered.length };
      }
    }

    return { changes: 0 };
  }

  // Utilitários para testes
  getTableData(tableName: string): any[] {
    return this.tables.get(tableName) || [];
  }

  setTableData(tableName: string, data: any[]) {
    this.tables.set(tableName, data);
  }

  getQueryHistory() {
    return [...this.queryHistory];
  }

  clearQueryHistory() {
    this.queryHistory = [];
  }

  reset() {
    this.tables.clear();
    this.queryHistory = [];
    this.shouldFail = false;
    this.delay = 0;
    this.initializeTables();
  }
}

// Instância global
export const sqliteMock = new SQLiteMock();

// Mock para jest
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve(sqliteMock)),
}));
```

## 🎯 Cenários de Simulação

### 1. Simulação de Cenários de Rede

```typescript
// scenarios/networkScenarios.ts
export class NetworkScenarios {
  constructor(private networkMock: NetworkMock) {}

  // Cenário: App inicia offline
  async appStartsOffline(syncEngine: any) {
    console.log("📱 Scenario: App starts offline");

    this.networkMock.setOnline(false);
    await syncEngine.initialize();
    await syncEngine.start();

    // Adiciona algumas operações offline
    await syncEngine.addToQueue("offline-1", "todo", {
      text: "Offline todo 1",
    });
    await syncEngine.addToQueue("offline-2", "todo", {
      text: "Offline todo 2",
    });

    const status = await syncEngine.getStatus();
    console.log("📊 Status após adicionar offline:", status);

    // Volta online após 3 segundos
    setTimeout(() => {
      console.log("📶 Going back online...");
      this.networkMock.setOnline(true);
    }, 3000);
  }

  // Cenário: Perda de conexão durante sync
  async connectionLostDuringSync(syncEngine: any, serverMock: HTTPServerMock) {
    console.log("📱 Scenario: Connection lost during sync");

    // Adiciona vários items
    for (let i = 0; i < 10; i++) {
      await syncEngine.addToQueue(`item-${i}`, "todo", { text: `Todo ${i}` });
    }

    // Configura servidor para responder lentamente
    serverMock.setDefaultDelay(1000);

    // Inicia sync
    const syncPromise = syncEngine.forceSync();

    // Perde conexão após 2 segundos
    setTimeout(() => {
      console.log("📵 Connection lost!");
      this.networkMock.setOnline(false);
    }, 2000);

    try {
      await syncPromise;
    } catch (error) {
      console.log("❌ Sync failed as expected:", error.message);
    }

    // Volta online após 5 segundos
    setTimeout(() => {
      console.log("📶 Connection restored");
      this.networkMock.setOnline(true);
    }, 5000);
  }

  // Cenário: Rede instável
  async unstableConnection(syncEngine: any) {
    console.log("📱 Scenario: Unstable connection");

    // Adiciona dados
    for (let i = 0; i < 5; i++) {
      await syncEngine.addToQueue(`unstable-${i}`, "todo", {
        text: `Unstable ${i}`,
      });
    }

    // Simula instabilidade por 10 segundos
    this.networkMock.simulateInstability(10000);

    // Tenta sincronizar durante instabilidade
    try {
      await syncEngine.forceSync();
    } catch (error) {
      console.log("❌ Sync affected by instability:", error.message);
    }
  }

  // Cenário: Mudança de tipo de conexão
  async connectionTypeChanges(syncEngine: any) {
    console.log("📱 Scenario: Connection type changes");

    // Inicia com WiFi
    this.networkMock.setConnectionType("wifi");
    await syncEngine.addToQueue("wifi-item", "todo", { text: "WiFi todo" });

    // Muda para cellular
    setTimeout(() => {
      console.log("📶 Switching to cellular...");
      this.networkMock.setConnectionType("cellular");
      this.networkMock.setExpensiveConnection(true);
    }, 2000);

    // Volta para WiFi
    setTimeout(() => {
      console.log("📶 Switching back to WiFi...");
      this.networkMock.setConnectionType("wifi");
      this.networkMock.setExpensiveConnection(false);
    }, 5000);
  }
}
```

### 2. Simulação de Erros de Servidor

```typescript
// scenarios/serverScenarios.ts
export class ServerScenarios {
  constructor(private serverMock: HTTPServerMock) {}

  // Cenário: Servidor retorna erros HTTP
  async serverHttpErrors(syncEngine: any) {
    console.log("🖥️  Scenario: Server HTTP errors");

    // Configura erros para diferentes rotas
    this.serverMock.mockRoute("POST", "/sync", { status: 500 });
    this.serverMock.mockRoute("POST", "/sync/batch", { status: 503 });

    await syncEngine.addToQueue("error-item", "todo", { text: "Error todo" });

    try {
      await syncEngine.forceSync();
    } catch (error) {
      console.log("❌ Expected server error:", error.message);
    }

    // Restaura servidor após 5 segundos
    setTimeout(() => {
      console.log("✅ Server recovered");
      this.serverMock.mockRoute("POST", "/sync", {
        status: 200,
        data: { success: true },
      });
    }, 5000);
  }

  // Cenário: Servidor lento
  async slowServer(syncEngine: any) {
    console.log("🖥️  Scenario: Slow server");

    this.serverMock.mockRoute("POST", "/sync", {
      status: 200,
      data: { success: true },
      delay: 5000, // 5 segundos
    });

    await syncEngine.addToQueue("slow-item", "todo", { text: "Slow todo" });

    const startTime = Date.now();
    await syncEngine.forceSync();
    const endTime = Date.now();

    console.log(`⏱️  Sync took ${endTime - startTime}ms`);
  }

  // Cenário: Conflitos de dados
  async dataConflicts(syncEngine: any) {
    console.log("🖥️  Scenario: Data conflicts");

    this.serverMock.mockRoute("POST", "/sync", {
      status: 200,
      data: {
        success: false,
        conflicts: [
          {
            id: "conflict-item",
            serverData: {
              text: "Server version",
              done: true,
              updatedAt: Date.now(),
            },
            conflictType: "concurrent",
          },
        ],
      },
    });

    await syncEngine.addToQueue("conflict-item", "todo", {
      text: "Client version",
      done: false,
    });

    await syncEngine.forceSync();
    console.log("🥊 Conflict should be resolved by strategy");
  }

  // Cenário: Respostas parcialmente válidas
  async partiallyValidResponses(syncEngine: any) {
    console.log("🖥️  Scenario: Partially valid responses");

    this.serverMock.mockRoute("POST", "/sync/batch", {
      status: 200,
      data: {
        success: true,
        results: [
          { id: "item-1", success: true },
          { id: "item-2", success: false, error: "Validation failed" },
          { id: "item-3", success: true },
        ],
      },
    });

    // Adiciona múltiplos items
    await syncEngine.addToQueue("item-1", "todo", { text: "Valid item 1" });
    await syncEngine.addToQueue("item-2", "todo", { text: "" }); // Inválido
    await syncEngine.addToQueue("item-3", "todo", { text: "Valid item 3" });

    await syncEngine.forceSync();

    const status = await syncEngine.getStatus();
    console.log("📊 Status após sync parcial:", status);
  }
}
```

### 3. Simulação de Problemas de Performance

```typescript
// scenarios/performanceScenarios.ts
export class PerformanceScenarios {
  constructor(
    private sqliteMock: SQLiteMock,
    private serverMock: HTTPServerMock
  ) {}

  // Cenário: Grande volume de dados
  async largeDataVolume(syncEngine: any) {
    console.log("📊 Scenario: Large data volume");

    const itemCount = 1000;
    const batchSize = 50;

    console.time("Adding items to queue");

    // Adiciona items em lotes
    for (let batch = 0; batch < itemCount / batchSize; batch++) {
      const promises = [];

      for (let i = 0; i < batchSize; i++) {
        const itemIndex = batch * batchSize + i;
        promises.push(
          syncEngine.addToQueue(`large-${itemIndex}`, "todo", {
            text: `Large dataset item ${itemIndex}`,
            description: "A".repeat(1000), // 1KB of data
            metadata: {
              category: `category-${itemIndex % 10}`,
              priority: itemIndex % 5,
              tags: Array.from({ length: 10 }, (_, i) => `tag-${i}`),
            },
          })
        );
      }

      await Promise.all(promises);
      console.log(`📦 Added batch ${batch + 1}/${itemCount / batchSize}`);
    }

    console.timeEnd("Adding items to queue");

    // Configura servidor para aceitar lotes grandes
    this.serverMock.mockRoute("POST", "/sync/batch", {
      status: 200,
      data: { success: true, results: [] },
      delay: 100, // Simula processamento
    });

    console.time("Syncing large dataset");
    await syncEngine.forceSync();
    console.timeEnd("Syncing large dataset");
  }

  // Cenário: SQLite lento
  async slowDatabase(syncEngine: any) {
    console.log("🗃️  Scenario: Slow database");

    // Simula operações SQLite lentas
    this.sqliteMock.setDelay(500);

    console.time("Operations with slow DB");

    await syncEngine.addToQueue("slow-db-1", "todo", {
      text: "Slow DB test 1",
    });
    await syncEngine.addToQueue("slow-db-2", "todo", {
      text: "Slow DB test 2",
    });

    const status = await syncEngine.getStatus();
    console.log("📊 Status with slow DB:", status);

    console.timeEnd("Operations with slow DB");

    // Restaura velocidade normal
    this.sqliteMock.setDelay(0);
  }

  // Cenário: Falhas intermitentes de SQLite
  async intermittentDatabaseFailures(syncEngine: any) {
    console.log("🗃️  Scenario: Intermittent database failures");

    let operationCount = 0;
    const originalRunAsync = this.sqliteMock.runAsync;

    // Mock que falha a cada 3ª operação
    this.sqliteMock.runAsync = async (sql: string, params?: any[]) => {
      operationCount++;
      if (operationCount % 3 === 0) {
        this.sqliteMock.setShouldFail(true);
      } else {
        this.sqliteMock.setShouldFail(false);
      }

      return originalRunAsync.call(this.sqliteMock, sql, params);
    };

    // Tenta adicionar vários items
    for (let i = 0; i < 10; i++) {
      try {
        await syncEngine.addToQueue(`intermittent-${i}`, "todo", {
          text: `Intermittent test ${i}`,
        });
        console.log(`✅ Item ${i} added successfully`);
      } catch (error) {
        console.log(`❌ Item ${i} failed: ${error.message}`);
      }
    }

    // Restaura comportamento normal
    this.sqliteMock.runAsync = originalRunAsync;
    this.sqliteMock.setShouldFail(false);
  }

  // Cenário: Vazamento de memória
  async memoryLeakSimulation(syncEngine: any) {
    console.log("🧠 Scenario: Memory leak simulation");

    const initialMemory = process.memoryUsage().heapUsed;
    console.log(
      `📊 Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`
    );

    // Simula uso intenso sem limpeza
    for (let round = 0; round < 50; round++) {
      for (let i = 0; i < 100; i++) {
        await syncEngine.addToQueue(`leak-${round}-${i}`, "todo", {
          text: `Memory test ${round}-${i}`,
          largeData: new Array(10000).fill("data"), // ~40KB por item
        });
      }

      // Simula sync sem limpeza
      await syncEngine.forceSync();

      const currentMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (currentMemory - initialMemory) / 1024 / 1024;

      console.log(`📊 Round ${round + 1}: +${memoryIncrease.toFixed(2)}MB`);

      if (memoryIncrease > 100) {
        // 100MB limite
        console.warn("⚠️  Potential memory leak detected!");
        break;
      }
    }
  }
}
```

## 🎮 Simulador de Cenários

```typescript
// simulator/scenarioSimulator.ts
export class ScenarioSimulator {
  private networkMock: NetworkMock;
  private serverMock: HTTPServerMock;
  private sqliteMock: SQLiteMock;

  private networkScenarios: NetworkScenarios;
  private serverScenarios: ServerScenarios;
  private performanceScenarios: PerformanceScenarios;

  constructor() {
    this.networkMock = new NetworkMock();
    this.serverMock = new HTTPServerMock();
    this.sqliteMock = new SQLiteMock();

    this.networkScenarios = new NetworkScenarios(this.networkMock);
    this.serverScenarios = new ServerScenarios(this.serverMock);
    this.performanceScenarios = new PerformanceScenarios(
      this.sqliteMock,
      this.serverMock
    );

    this.setupMocks();
  }

  private setupMocks() {
    // Setup global mocks
    setupServerMock();

    // Replace network mock
    jest.mock("@react-native-community/netinfo", () => ({
      fetch: () => this.networkMock.fetch(),
      addEventListener: (listener: any) =>
        this.networkMock.addEventListener(listener),
    }));

    // Replace SQLite mock
    jest.mock("expo-sqlite", () => ({
      openDatabaseAsync: jest.fn(() => Promise.resolve(this.sqliteMock)),
    }));
  }

  // Executa cenário específico
  async runScenario(scenarioName: string, syncEngine: any, options: any = {}) {
    console.log(`🎬 Running scenario: ${scenarioName}`);

    try {
      switch (scenarioName) {
        case "app-starts-offline":
          await this.networkScenarios.appStartsOffline(syncEngine);
          break;

        case "connection-lost-during-sync":
          await this.networkScenarios.connectionLostDuringSync(
            syncEngine,
            this.serverMock
          );
          break;

        case "unstable-connection":
          await this.networkScenarios.unstableConnection(syncEngine);
          break;

        case "server-http-errors":
          await this.serverScenarios.serverHttpErrors(syncEngine);
          break;

        case "data-conflicts":
          await this.serverScenarios.dataConflicts(syncEngine);
          break;

        case "large-data-volume":
          await this.performanceScenarios.largeDataVolume(syncEngine);
          break;

        case "slow-database":
          await this.performanceScenarios.slowDatabase(syncEngine);
          break;

        default:
          throw new Error(`Unknown scenario: ${scenarioName}`);
      }

      console.log(`✅ Scenario completed: ${scenarioName}`);
    } catch (error) {
      console.error(`❌ Scenario failed: ${scenarioName}`, error);
      throw error;
    }
  }

  // Executa múltiplos cenários em sequência
  async runScenarioSuite(scenarios: string[], syncEngine: any) {
    console.log(`🎭 Running scenario suite: ${scenarios.length} scenarios`);

    for (const scenario of scenarios) {
      await this.runScenario(scenario, syncEngine);

      // Reset state entre cenários
      this.reset();
      await syncEngine.clearSyncedItems();

      // Pequena pausa entre cenários
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("🎉 All scenarios completed successfully");
  }

  // Configura cenário customizado
  configureCustomScenario(config: {
    network?: {
      online?: boolean;
      type?: string;
      unstable?: boolean;
    };
    server?: {
      delay?: number;
      failureRate?: number;
      responses?: Array<{
        method: string;
        path: string;
        response: any;
      }>;
    };
    database?: {
      delay?: number;
      shouldFail?: boolean;
    };
  }) {
    // Configurar rede
    if (config.network) {
      if (config.network.online !== undefined) {
        this.networkMock.setOnline(config.network.online);
      }
      if (config.network.type) {
        this.networkMock.setConnectionType(config.network.type as any);
      }
      if (config.network.unstable) {
        this.networkMock.simulateInstability();
      }
    }

    // Configurar servidor
    if (config.server) {
      if (config.server.delay) {
        this.serverMock.setDefaultDelay(config.server.delay);
      }
      if (config.server.failureRate) {
        this.serverMock.setFailureRate(config.server.failureRate);
      }
      if (config.server.responses) {
        config.server.responses.forEach(({ method, path, response }) => {
          this.serverMock.mockRoute(method, path, response);
        });
      }
    }

    // Configurar database
    if (config.database) {
      if (config.database.delay) {
        this.sqliteMock.setDelay(config.database.delay);
      }
      if (config.database.shouldFail !== undefined) {
        this.sqliteMock.setShouldFail(config.database.shouldFail);
      }
    }
  }

  // Reset todos os mocks
  reset() {
    this.networkMock = new NetworkMock();
    this.serverMock.reset();
    this.sqliteMock.reset();
  }

  // Obtém estatísticas dos mocks
  getStats() {
    return {
      network: {
        isOnline: this.networkMock.fetch(),
      },
      server: {
        requestCount: this.serverMock.getRequestCount(),
        requestHistory: this.serverMock.getRequestHistory(),
      },
      database: {
        queryHistory: this.sqliteMock.getQueryHistory(),
        tableData: {
          outbox: this.sqliteMock.getTableData("outbox"),
          metadata: this.sqliteMock.getTableData("entity_metadata"),
        },
      },
    };
  }
}
```

## 🧪 Usando o Simulador em Testes

```typescript
// __tests__/scenarioTests.test.ts
import { ScenarioSimulator } from "../simulator/scenarioSimulator";
import { SyncEngineFactory } from "sync-engine-lib";

describe("Scenario Simulation Tests", () => {
  let simulator: ScenarioSimulator;
  let syncEngine: any;

  beforeEach(async () => {
    simulator = new ScenarioSimulator();
    syncEngine = SyncEngineFactory.createForDevelopment(
      "http://localhost:3000"
    );
    await syncEngine.initialize();
  });

  afterEach(async () => {
    await syncEngine.destroy();
    simulator.reset();
  });

  it("should handle app starting offline scenario", async () => {
    await simulator.runScenario("app-starts-offline", syncEngine);

    // Verificações após cenário
    const stats = simulator.getStats();
    expect(stats.database.tableData.outbox).toHaveLength(2);
  });

  it("should handle connection lost during sync", async () => {
    await simulator.runScenario("connection-lost-during-sync", syncEngine);

    const status = await syncEngine.getStatus();
    expect(status.errorItems).toBeGreaterThan(0);
  });

  it("should run complete scenario suite", async () => {
    const scenarios = [
      "app-starts-offline",
      "server-http-errors",
      "data-conflicts",
    ];

    await simulator.runScenarioSuite(scenarios, syncEngine);

    // Todos os cenários devem ter executado sem erro fatal
    expect(true).toBe(true);
  });

  it("should handle custom scenario configuration", async () => {
    simulator.configureCustomScenario({
      network: { online: false },
      server: { delay: 1000, failureRate: 0.5 },
      database: { delay: 100 },
    });

    await syncEngine.addToQueue("custom-test", "todo", {
      text: "Custom scenario",
    });

    // Deve falhar devido à configuração
    await expect(syncEngine.forceSync()).rejects.toThrow();
  });
});
```

Este sistema de mocking e simulação fornece uma base robusta para testar todos os aspectos da sincronização offline, permitindo reproduzir cenários complexos de forma controlada e repetível.
