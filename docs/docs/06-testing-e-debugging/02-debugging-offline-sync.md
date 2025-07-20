# Debugging de Sincronização Offline

Debuggar aplicações offline-first pode ser complexo devido à natureza assíncrona e aos múltiplos estados de conectividade. Este guia fornece técnicas e ferramentas essenciais para identificar e resolver problemas.

## 🔍 Habilitando Debug Mode

### Configuração Básica

```typescript
import { SyncEngineFactory } from "sync-engine-lib";

// Habilita debug detalhado
const syncEngine = SyncEngineFactory.createForDevelopment(
  "http://localhost:4000",
  {
    debug: true, // ✅ Habilita logs detalhados
    config: {
      syncInterval: 10000, // Sync mais frequente para debug
    },
  }
);
```

### Logs Estruturados

```typescript
// Custom logger para diferentes níveis
class SyncLogger {
  private prefix = "[SyncEngine]";

  debug(message: string, data?: any) {
    if (__DEV__) {
      console.log(`${this.prefix} 🔍 ${message}`, data || "");
    }
  }

  info(message: string, data?: any) {
    console.info(`${this.prefix} ℹ️  ${message}`, data || "");
  }

  warn(message: string, data?: any) {
    console.warn(`${this.prefix} ⚠️  ${message}`, data || "");
  }

  error(message: string, error?: any) {
    console.error(`${this.prefix} ❌ ${message}`, error || "");
  }
}

const logger = new SyncLogger();
```

## 📊 Monitoramento de Estado

### Debug Dashboard Component

```typescript
// components/SyncDebugDashboard.tsx
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Button } from "react-native";

interface SyncDebugDashboardProps {
  syncEngine: any;
}

export const SyncDebugDashboard: React.FC<SyncDebugDashboardProps> = ({
  syncEngine,
}) => {
  const [status, setStatus] = useState<any>(null);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const updateStatus = async () => {
      const currentStatus = await syncEngine.getStatus();
      setStatus(currentStatus);

      const items = await syncEngine.getQueuedItems();
      setQueueItems(items);
    };

    // Atualiza status a cada segundo
    const interval = setInterval(updateStatus, 1000);
    updateStatus();

    // Listen para eventos de sync
    const eventListener = (event: any) => {
      setEvents((prev) => [
        {
          ...event,
          timestamp: new Date(event.timestamp).toLocaleTimeString(),
        },
        ...prev.slice(0, 49), // Mantém últimos 50 eventos
      ]);
    };

    syncEngine.addEventListener(eventListener);

    return () => {
      clearInterval(interval);
      syncEngine.removeEventListener(eventListener);
    };
  }, [syncEngine]);

  const forceSync = async () => {
    try {
      const result = await syncEngine.forceSync();
      addLog(
        `Force sync completed: ${result.syncedItems} synced, ${result.errors} errors`
      );
    } catch (error) {
      addLog(`Force sync failed: ${error.message}`);
    }
  };

  const clearQueue = async () => {
    await syncEngine.clearSyncedItems();
    addLog("Synced items cleared from queue");
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  };

  const getStatusColor = () => {
    if (!status) return "#gray";
    if (!status.isOnline) return "#red";
    if (status.isSyncing) return "#orange";
    if (status.pendingItems > 0) return "#yellow";
    return "#green";
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      {/* Status Card */}
      <View
        style={{
          backgroundColor: getStatusColor(),
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "bold", color: "white" }}>
          Sync Status
        </Text>
        {status && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: "white" }}>
              Online: {status.isOnline ? "✅" : "❌"}
            </Text>
            <Text style={{ color: "white" }}>
              Syncing: {status.isSyncing ? "🔄" : "⏸️"}
            </Text>
            <Text style={{ color: "white" }}>
              Pending: {status.pendingItems}
            </Text>
            <Text style={{ color: "white" }}>Errors: {status.errorItems}</Text>
            <Text style={{ color: "white" }}>
              Last Sync:{" "}
              {status.lastSync
                ? new Date(status.lastSync).toLocaleTimeString()
                : "Never"}
            </Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={{ flexDirection: "row", marginBottom: 16 }}>
        <Button title="Force Sync" onPress={forceSync} />
        <Button title="Clear Queue" onPress={clearQueue} />
        <Button
          title={status?.isOnline ? "Go Offline" : "Go Online"}
          onPress={() => {
            syncEngine.setForcedOnline(status?.isOnline ? false : true);
            addLog(`Forced ${status?.isOnline ? "offline" : "online"} mode`);
          }}
        />
      </View>

      {/* Queue Items */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>
          Queue Items ({queueItems.length})
        </Text>
        {queueItems.slice(0, 10).map((item, index) => (
          <View
            key={item.id}
            style={{
              backgroundColor: "#f0f0f0",
              padding: 8,
              marginBottom: 4,
              borderRadius: 4,
            }}
          >
            <Text style={{ fontWeight: "bold" }}>
              {item.type}:{item.id}
            </Text>
            <Text>Status: {item.status}</Text>
            <Text>Retries: {item.retries}</Text>
            <Text numberOfLines={2}>
              Data: {JSON.stringify(item.payload).substring(0, 100)}...
            </Text>
          </View>
        ))}
      </View>

      {/* Recent Events */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>
          Recent Events ({events.length})
        </Text>
        {events.slice(0, 10).map((event, index) => (
          <View
            key={index}
            style={{
              backgroundColor: event.error ? "#ffebee" : "#e8f5e8",
              padding: 8,
              marginBottom: 4,
              borderRadius: 4,
            }}
          >
            <Text style={{ fontWeight: "bold" }}>
              {event.timestamp} - {event.type}
            </Text>
            {event.data && (
              <Text numberOfLines={2}>
                {JSON.stringify(event.data).substring(0, 150)}...
              </Text>
            )}
            {event.error && (
              <Text style={{ color: "red" }}>Error: {event.error.message}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Debug Logs */}
      <View>
        <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>
          Debug Logs ({logs.length})
        </Text>
        {logs.slice(0, 20).map((log, index) => (
          <Text
            key={index}
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              backgroundColor: "#f5f5f5",
              padding: 4,
              marginBottom: 2,
            }}
          >
            {log}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
};
```

## 🐛 Debugging Específico por Problema

### 1. Items Não Estão Sincronizando

```typescript
// Debugging de sync issues
const debugSyncIssues = async (syncEngine: any) => {
  console.log("🔍 Debugging sync issues...");

  // 1. Verificar conectividade
  const connectionDetails = await syncEngine.network.getConnectionDetails();
  console.log("📡 Connection:", connectionDetails);

  // 2. Verificar status do engine
  const status = await syncEngine.getStatus();
  console.log("📊 Status:", status);

  // 3. Verificar items na queue
  const queueItems = await syncEngine.getQueuedItems();
  console.log("📋 Queue items:", queueItems.length);

  queueItems.forEach((item, index) => {
    console.log(`📄 Item ${index + 1}:`, {
      id: item.id,
      type: item.type,
      status: item.status,
      retries: item.retries,
      lastTried: item.lastTriedAt ? new Date(item.lastTriedAt) : "never",
      data: JSON.stringify(item.payload).substring(0, 100),
    });
  });

  // 4. Verificar configuração
  const config = syncEngine.config;
  console.log("⚙️ Config:", {
    serverUrl: config.serverUrl,
    batchSize: config.batchSize,
    maxRetries: config.maxRetries,
    syncInterval: config.syncInterval,
  });

  // 5. Testar conectividade manual
  try {
    const response = await fetch(`${config.serverUrl}/health`);
    console.log("🏥 Server health:", response.ok ? "OK" : "FAILED");
  } catch (error) {
    console.log("🏥 Server health: ERROR -", error.message);
  }
};

// Uso
debugSyncIssues(syncEngine);
```

### 2. Conflitos Não Estão Sendo Resolvidos

```typescript
// Debug de resolução de conflitos
const debugConflictResolution = (syncEngine: any) => {
  console.log("🥊 Debugging conflict resolution...");

  // Interceptar resolução de conflitos
  const originalResolve = syncEngine.conflictResolver.resolve;

  syncEngine.conflictResolver.resolve = async (
    localItem: any,
    serverItem: any
  ) => {
    console.log("🥊 Conflict detected!");
    console.log("📱 Local item:", localItem);
    console.log("🖥️  Server item:", serverItem);

    const result = await originalResolve.call(
      syncEngine.conflictResolver,
      localItem,
      serverItem
    );

    console.log("✅ Conflict resolved:", result);
    return result;
  };
};
```

### 3. Performance Issues

```typescript
// Debug de performance
class PerformanceDebugger {
  private timers: Map<string, number> = new Map();
  private syncEngine: any;

  constructor(syncEngine: any) {
    this.syncEngine = syncEngine;
    this.setupPerformanceMonitoring();
  }

  private setupPerformanceMonitoring() {
    // Monitor sync duration
    const originalForceSync = this.syncEngine.forceSync;
    this.syncEngine.forceSync = async (...args: any[]) => {
      const startTime = Date.now();
      const result = await originalForceSync.apply(this.syncEngine, args);
      const duration = Date.now() - startTime;

      console.log(`⏱️  Sync completed in ${duration}ms`);
      console.log(`📊 Sync result:`, result);

      if (duration > 5000) {
        console.warn("⚠️  Slow sync detected! Duration:", duration);
        this.analyzeSyncPerformance();
      }

      return result;
    };

    // Monitor queue operations
    const originalAddToQueue = this.syncEngine.addToQueue;
    this.syncEngine.addToQueue = async (...args: any[]) => {
      const startTime = Date.now();
      const result = await originalAddToQueue.apply(this.syncEngine, args);
      const duration = Date.now() - startTime;

      if (duration > 100) {
        console.warn(`⚠️  Slow queue operation: ${duration}ms`);
      }

      return result;
    };
  }

  private async analyzeSyncPerformance() {
    const status = await this.syncEngine.getStatus();
    const queueItems = await this.syncEngine.getQueuedItems();

    console.log("🔍 Performance Analysis:");
    console.log(`📋 Queue size: ${queueItems.length}`);
    console.log(`⚠️  Error items: ${status.errorItems}`);
    console.log(`🔄 Pending items: ${status.pendingItems}`);

    // Analisa tamanho dos payloads
    const payloadSizes = queueItems.map(
      (item) => JSON.stringify(item.payload).length
    );

    if (payloadSizes.length > 0) {
      const avgSize =
        payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length;
      const maxSize = Math.max(...payloadSizes);

      console.log(`📦 Average payload size: ${avgSize.toFixed(0)} bytes`);
      console.log(`📦 Max payload size: ${maxSize} bytes`);

      if (maxSize > 50000) {
        // 50KB
        console.warn(
          "⚠️  Large payloads detected! Consider breaking into smaller chunks."
        );
      }
    }
  }

  startTimer(name: string) {
    this.timers.set(name, Date.now());
  }

  endTimer(name: string) {
    const startTime = this.timers.get(name);
    if (startTime) {
      const duration = Date.now() - startTime;
      console.log(`⏱️  ${name}: ${duration}ms`);
      this.timers.delete(name);
      return duration;
    }
    return 0;
  }
}

// Uso
const perfDebugger = new PerformanceDebugger(syncEngine);
```

## 🔧 Ferramentas de Debug

### 1. Network Interceptor

```typescript
// Network request debugger
class NetworkDebugger {
  static setup() {
    const originalFetch = global.fetch;

    global.fetch = async (url: string, options?: any) => {
      const startTime = Date.now();

      console.log("🌐 HTTP Request:", {
        url,
        method: options?.method || "GET",
        headers: options?.headers,
        bodySize: options?.body ? options.body.length : 0,
      });

      try {
        const response = await originalFetch(url, options);
        const duration = Date.now() - startTime;

        console.log("✅ HTTP Response:", {
          url,
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`,
        });

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        console.error("❌ HTTP Error:", {
          url,
          error: error.message,
          duration: `${duration}ms`,
        });

        throw error;
      }
    };
  }

  static restore() {
    // Restore original fetch if needed
  }
}

// Ativar no desenvolvimento
if (__DEV__) {
  NetworkDebugger.setup();
}
```

### 2. SQLite Debug

```typescript
// Debug SQLite operations
class SQLiteDebugger {
  static wrapDatabase(db: any) {
    const originalExecAsync = db.execAsync;
    const originalGetAllAsync = db.getAllAsync;
    const originalRunAsync = db.runAsync;

    db.execAsync = async (sql: string) => {
      console.log("🗃️  SQL Exec:", sql);
      const startTime = Date.now();

      try {
        const result = await originalExecAsync.call(db, sql);
        console.log(`✅ SQL Success (${Date.now() - startTime}ms)`);
        return result;
      } catch (error) {
        console.error("❌ SQL Error:", error.message);
        throw error;
      }
    };

    db.getAllAsync = async (sql: string, params?: any[]) => {
      console.log("🗃️  SQL Query:", sql, params || []);
      const startTime = Date.now();

      try {
        const result = await originalGetAllAsync.call(db, sql, params);
        console.log(
          `✅ SQL Query Success (${Date.now() - startTime}ms): ${
            result.length
          } rows`
        );
        return result;
      } catch (error) {
        console.error("❌ SQL Query Error:", error.message);
        throw error;
      }
    };

    db.runAsync = async (sql: string, params?: any[]) => {
      console.log("🗃️  SQL Run:", sql, params || []);
      const startTime = Date.now();

      try {
        const result = await originalRunAsync.call(db, sql, params);
        console.log(`✅ SQL Run Success (${Date.now() - startTime}ms)`);
        return result;
      } catch (error) {
        console.error("❌ SQL Run Error:", error.message);
        throw error;
      }
    };

    return db;
  }
}
```

### 3. Event Debugger

```typescript
// Debug eventos de sync
class EventDebugger {
  private events: any[] = [];

  constructor(syncEngine: any) {
    syncEngine.addEventListener((event: any) => {
      this.events.push({
        ...event,
        timestamp: new Date(event.timestamp).toISOString(),
      });

      this.logEvent(event);
      this.analyzeEventPattern(event);
    });
  }

  private logEvent(event: any) {
    const emoji = this.getEventEmoji(event.type);
    console.log(`${emoji} Event: ${event.type}`, event.data || "");

    if (event.error) {
      console.error("❌ Event Error:", event.error);
    }
  }

  private getEventEmoji(type: string): string {
    const emojiMap: { [key: string]: string } = {
      sync_started: "🚀",
      sync_completed: "✅",
      sync_failed: "❌",
      item_queued: "📥",
      item_synced: "📤",
      item_failed: "⚠️",
      connection_changed: "📶",
      queue_changed: "📋",
    };

    return emojiMap[type] || "📢";
  }

  private analyzeEventPattern(event: any) {
    const recentEvents = this.events.slice(-10);

    // Detecta loops de erro
    const errorEvents = recentEvents.filter((e) => e.type === "sync_failed");
    if (errorEvents.length >= 3) {
      console.warn("⚠️  Repeated sync failures detected!");
    }

    // Detecta sincronização muito frequente
    const syncEvents = recentEvents.filter((e) => e.type === "sync_started");
    if (syncEvents.length >= 5) {
      const timeDiff =
        syncEvents[syncEvents.length - 1].timestamp - syncEvents[0].timestamp;
      if (timeDiff < 30000) {
        // 30 segundos
        console.warn(
          "⚠️  Very frequent syncing detected! Consider increasing sync interval."
        );
      }
    }
  }

  getEventSummary() {
    const summary = this.events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    console.log("📊 Event Summary:", summary);
    return summary;
  }

  getRecentEvents(count: number = 20) {
    return this.events.slice(-count);
  }
}
```

## 🛠️ React Native Debugger Integration

### Setup para React Native Debugger

```typescript
// Debug integration for React Native Debugger
if (__DEV__ && typeof window !== "undefined") {
  // Adiciona syncEngine ao objeto global para debug
  (window as any).syncEngine = syncEngine;

  // Adiciona helper functions
  (window as any).debugSync = {
    status: () => syncEngine.getStatus(),
    queue: () => syncEngine.getQueuedItems(),
    forceSync: () => syncEngine.forceSync(),
    clearQueue: () => syncEngine.clearSyncedItems(),
    goOffline: () => syncEngine.setForcedOnline(false),
    goOnline: () => syncEngine.setForcedOnline(true),

    // Helper para adicionar dados de teste
    addTestData: async (count: number = 10) => {
      for (let i = 0; i < count; i++) {
        await syncEngine.addToQueue(`test-${i}`, "todo", {
          text: `Test todo ${i}`,
          done: Math.random() > 0.5,
          createdAt: Date.now(),
        });
      }
      console.log(`Added ${count} test items to queue`);
    },
  };

  console.log("🐛 Debug helpers available:");
  console.log("- window.syncEngine (SyncEngine instance)");
  console.log("- window.debugSync.* (Debug helpers)");
}
```

## 📱 Debug em Dispositivos Físicos

### Flipper Integration

```typescript
// Flipper debug plugin
if (__DEV__) {
  import("react-native-flipper").then((Flipper) => {
    let connection: any;

    Flipper.default.addPlugin({
      getId() {
        return "SyncEngineDebugger";
      },
      onConnect(newConnection) {
        connection = newConnection;

        // Envia status inicial
        syncEngine.getStatus().then((status: any) => {
          connection.send("status", status);
        });

        // Listen para eventos
        syncEngine.addEventListener((event: any) => {
          connection.send("event", event);
        });

        // Handle commands from Flipper
        connection.receive("forceSync", async () => {
          const result = await syncEngine.forceSync();
          connection.send("syncResult", result);
        });

        connection.receive("clearQueue", async () => {
          await syncEngine.clearSyncedItems();
          connection.send("message", "Queue cleared");
        });
      },
      onDisconnect() {
        connection = null;
      },
      runInBackground() {
        return false;
      },
    });
  });
}
```

## 🎯 Debugging Checklist

Quando enfrentar problemas de sync, siga este checklist:

### ✅ Conectividade

- [ ] Dispositivo está online?
- [ ] Server está respondendo?
- [ ] URLs estão corretas?
- [ ] Headers de autenticação corretos?

### ✅ Configuração

- [ ] SyncEngine foi inicializado?
- [ ] `start()` foi chamado?
- [ ] Configuração está válida?
- [ ] Modo debug habilitado?

### ✅ Queue

- [ ] Items estão sendo adicionados à queue?
- [ ] Status dos items está correto?
- [ ] Não há items travados em "syncing"?

### ✅ Eventos

- [ ] Eventos estão sendo emitidos?
- [ ] Listeners estão configurados?
- [ ] Não há loops de eventos?

### ✅ Performance

- [ ] Sync não está muito lento?
- [ ] Payloads não estão muito grandes?
- [ ] Não há vazamentos de memória?

Este guia de debugging deve ajudá-lo a identificar e resolver a maioria dos problemas relacionados à sincronização offline. Lembre-se sempre de habilitar o modo debug durante desenvolvimento!
