# 📦 Sync Engine Lib

[![npm version](https://img.shields.io/npm/v/sync-engine-lib.svg)](https://www.npmjs.com/package/sync-engine-lib)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.73+-green.svg)](https://reactnative.dev/)
[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-50+-purple.svg)](https://expo.dev/)

Biblioteca TypeScript para sincronização bidirecional offline-first em React Native/Expo com SQLite.

## 🚀 Características

- ✅ **Sincronização bidirecional** automática entre app e servidor
- 📱 **100% offline-first** - todas operações funcionam sem internet
- 🔄 **Fila persistente** com SQLite para garantir entrega
- ⚡ **Resolução de conflitos** configurável
- 🔁 **Retry automático** com backoff exponencial
- 📊 **Monitoramento de conexão** em tempo real
- 🎯 **TypeScript** com tipos completos
- 🧪 **Testado em produção**

## 📦 Instalação

```bash
npm install sync-engine-lib
# ou
yarn add sync-engine-lib
```

### Dependências necessárias

```bash
npm install expo-sqlite @react-native-community/netinfo
# ou
yarn add expo-sqlite @react-native-community/netinfo
```

### Dependências opcionais (para sincronização em background)

```bash
npm install expo-background-task expo-task-manager
# ou
yarn add expo-background-task expo-task-manager
```

## 🎯 Uso Rápido

```typescript
import { SyncEngineFactory, SyncEngineUtils } from 'sync-engine-lib';

// Criar instância do SyncEngine
const syncEngine = SyncEngineFactory.createForProduction(
  'https://api.exemplo.com'
);

// Inicializar e começar sincronização
await syncEngine.initialize();
await syncEngine.start();

// Adicionar item à fila (funciona offline)
await syncEngine.addToQueue(
  SyncEngineUtils.generateId(),
  'todo',
  {
    text: 'Minha tarefa',
    done: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
);

// Monitorar status
syncEngine.on('sync_completed', (event) => {
  console.log('Sincronização concluída!', event.data);
});
```

## 📊 APIs Principais

| Classe/Módulo | Descrição |
|---------------|------------|
| `SyncEngine` | Motor principal de sincronização |
| `OfflineFirstDB` | Banco de dados SQLite com suporte offline |
| `OfflineFirstEngine` | Engine completo com DB + Sync integrados |
| `BackgroundSyncWorker` | Worker para sincronização em background |
| `ConflictResolver` | Estratégias de resolução de conflitos |
| `NetMonitor` | Monitor de conectividade de rede |
| `QueueStorage` | Armazenamento persistente da fila |
| `RetryPolicy` | Políticas de retry configuráveis |

### Factories e Utilitários

```typescript
// Factories pré-configurados
SyncEngineFactory.createForDevelopment(url)  // Config para dev
SyncEngineFactory.createForProduction(url)   // Config para prod
SyncEngineFactory.createConservative(url)    // Baixo consumo
SyncEngineFactory.createAggressive(url)      // Alta performance

// Utilitários
SyncEngineUtils.generateId()                 // Gerar ID único
SyncEngineUtils.validateConfig(config)       // Validar configuração
SyncEngineUtils.createOptimizedConfig(url, preset)
```

### Estratégias de Conflito

```typescript
import { ConflictStrategies } from 'sync-engine-lib';

// Estratégias disponíveis
ConflictStrategies.clientWins()    // Cliente sempre vence
ConflictStrategies.serverWins()    // Servidor sempre vence
ConflictStrategies.timestampWins() // Mais recente vence
ConflictStrategies.manual()        // Resolução manual
ConflictStrategies.merge()         // Merge automático
```

## 🔧 Configuração Avançada

```typescript
import { SyncEngine, ConflictStrategies } from 'sync-engine-lib';

const syncEngine = new SyncEngine({
  config: {
    serverUrl: 'https://api.exemplo.com',
    batchSize: 25,
    syncInterval: 30000,
    maxRetries: 3,
    initialRetryDelay: 1000,
    backoffMultiplier: 1.8,
    requestTimeout: 15000,
    maxConcurrentRequests: 4,
    enableBatchSync: true,
    cacheExpiration: 30000,
    headers: {
      'Authorization': 'Bearer token'
    }
  },
  conflictStrategy: ConflictStrategies.timestampWins(),
  hooks: {
    onBeforeSync: async (items) => {
      console.log('Preparando para sincronizar', items.length, 'itens');
    },
    onSyncSuccess: async (items) => {
      console.log('Sincronização bem-sucedida!');
    },
    onSyncError: async (error, items) => {
      console.error('Erro na sincronização:', error);
    }
  },
  debug: true
});
```

## 🌐 Modo Offline

```typescript
// Forçar modo offline (útil para testes)
syncEngine.setForcedOnline(false);

// Voltar ao modo automático
syncEngine.setForcedOnline(null);

// Verificar status
const status = await syncEngine.getStatus();
console.log({
  online: status.isOnline,
  pendentes: status.pendingItems,
  erros: status.errorItems
});
```

## 📱 Background Sync (React Native)

```typescript
import { addBackgroundSyncToEngine } from 'sync-engine-lib';

// Adicionar suporte a background sync
const engineWithBg = addBackgroundSyncToEngine(syncEngine, {
  taskName: 'SYNC_TASK',
  interval: 900, // 15 minutos
  options: {
    minimumInterval: 900,
    stopOnTerminate: false,
    startOnBoot: true
  }
});

// Registrar e iniciar
await engineWithBg.registerBackgroundTask();
```

## 📋 Requisitos

- **React Native**: 0.73+
- **Expo SDK**: 50+ (se usando Expo)
- **TypeScript**: 5.0+
- **Plataformas**: iOS, Android

## 🔗 Links

- [Documentação completa](https://rn-sync-engine-docs.vercel.app)
- [Exemplos](https://github.com/LuizHGodoy/sync-engine/tree/main/apps/demo-app)
- [Changelog](https://github.com/LuizHGodoy/sync-engine/blob/main/CHANGELOG.md)
- [Issues](https://github.com/LuizHGodoy/sync-engine/issues)

## 📄 Licença

MIT © [LuizHGodoy](https://github.com/LuizHGodoy)

---

**Nota**: Esta biblioteca faz parte do [Sync Engine Monorepo](https://github.com/LuizHGodoy/sync-engine). Para exemplos completos e servidor de demonstração, visite o repositório principal.
