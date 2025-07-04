# Monorepo: Sync Engine

Este repositório é um monorepo contendo:

- `packages/sync-engine-lib`: Biblioteca TypeScript para sincronização bidirecional offline-first em React Native/Expo.
- `apps/demo-app`: App de demonstração Expo usando a biblioteca.

---

# 📦 Sync Engine Lib

Uma biblioteca TypeScript para sincronização bidirecional offline-first em React Native/Expo SDK 53. Permite que múltiplos apps reutilizem esta lib de forma plug-and-play, garantindo experiência offline robusta com autosync, retry inteligente e resolução de conflitos.

## ✨ Características

- 🔄 **Sincronização bidirecional** cliente ↔ servidor
- 📱 **Offline-first** com queue persistente SQLite
- 🚀 **Autosync** ao conectar, abrir app ou voltar do background
- 🔁 **Retry automático** com backoff exponencial
- ⚔️ **Resolução de conflitos** pluggável
- 📊 **Observabilidade** com status global e eventos
- 🎣 **Hooks customizáveis** (`onBeforeSync`, `onSuccess`, `onError`)
- 🧩 **Modular** e extensível
- 📚 **Totalmente tipado** em TypeScript

## 🛠️ Instalação

```bash
npm install sync-engine-lib
# ou
yarn add sync-engine-lib
```

### Dependências

Esta biblioteca requer as seguintes peer dependencies:

```bash
npm install expo-sqlite @react-native-community/netinfo
```

## 🚀 Uso Básico

### Configuração Simples

```typescript
import { SyncEngineFactory } from "sync-engine-lib";

// Para desenvolvimento (com logs)
const syncEngine = SyncEngineFactory.createForDevelopment(
  "https://api.meuapp.com"
);

// Para produção (otimizado)
const syncEngine = SyncEngineFactory.createForProduction(
  "https://api.meuapp.com"
);

// Inicializa e inicia
await syncEngine.initialize();
await syncEngine.start();
```

### Configuração Manual

```typescript
import {
  SyncEngine,
  SyncEngineUtils,
  ConflictStrategies,
} from "sync-engine-lib";

const config = SyncEngineUtils.createDefaultConfig("https://api.meuapp.com");

const syncEngine = new SyncEngine({
  config: {
    ...config,
    batchSize: 15,
    syncInterval: 30000, // 30 segundos
    maxRetries: 5,
  },
  conflictStrategy: ConflictStrategies.timestampWins(),
  debug: true,
  hooks: {
    onBeforeSync: async (items) => {
      console.log(`Sincronizando ${items.length} items`);
    },
    onSyncSuccess: async (items) => {
      console.log("Sync concluído com sucesso");
    },
    onSyncError: async (error, items) => {
      console.error("Erro no sync:", error);
    },
  },
});

await syncEngine.initialize();
await syncEngine.start();
```

## 📝 Adicionando Items à Queue

```typescript
import { SyncEngineUtils } from "sync-engine-lib";

// Adiciona um item à queue
await syncEngine.addToQueue(
  SyncEngineUtils.generateId(), // ID único
  "user_profile", // Tipo do item
  {
    // Payload
    name: "João Silva",
    email: "joao@email.com",
    updatedAt: Date.now(),
  }
);

// Item de check-in
await syncEngine.addToQueue(SyncEngineUtils.generateId(), "checkin", {
  location: { lat: -23.55052, lng: -46.633308 },
  timestamp: Date.now(),
  notes: "Check-in no escritório",
});
```

## 🔄 Sincronização

```typescript
// Força uma sincronização imediata
const result = await syncEngine.forceSync();
console.log(`${result.syncedItems} sincronizados, ${result.errors} erros`);

// Verifica status atual
const status = await syncEngine.getStatus();
console.log("Status:", status);
/*
{
  isActive: true,
  lastSync: 1671234567890,
  pendingItems: 3,
  errorItems: 0,
  isOnline: true,
  isSyncing: false
}
*/
```

## 🎭 Estratégias de Conflito

### Estratégias Predefinidas

```typescript
import { ConflictStrategies } from "sync-engine-lib";

// Cliente sempre vence
ConflictStrategies.clientWins();

// Servidor sempre vence
ConflictStrategies.serverWins();

// Timestamp mais recente vence
ConflictStrategies.timestampWins();

// Merge simples de propriedades
ConflictStrategies.merge();

// Merge inteligente preservando campos específicos
ConflictStrategies.smartMerge(["id", "createdAt", "userId"]);

// Baseado em versão
ConflictStrategies.versionBased();

// Mantém ambas as versões
ConflictStrategies.keepBoth();

// Força tratamento manual
ConflictStrategies.manual();
```

### Estratégia Customizada

```typescript
const customStrategy = ConflictStrategies.custom(
  async (localItem, serverItem) => {
    // Lógica personalizada de resolução
    if (localItem.payload.priority > serverItem.priority) {
      return {
        ...localItem,
        payload: {
          ...localItem.payload,
          conflictResolved: true,
          serverVersion: serverItem,
        },
        updatedAt: Date.now(),
      };
    }

    return {
      ...localItem,
      payload: serverItem,
      updatedAt: Date.now(),
    };
  }
);

const syncEngine = new SyncEngine({
  config,
  conflictStrategy: customStrategy,
});
```

## 📡 Eventos e Observabilidade

```typescript
// Adiciona listener de eventos
syncEngine.addEventListener((event) => {
  switch (event.type) {
    case "sync_started":
      console.log("Sync iniciado");
      break;

    case "sync_completed":
      console.log("Sync completo:", event.data);
      break;

    case "item_queued":
      console.log("Item adicionado:", event.data);
      break;

    case "connection_changed":
      console.log("Conexão mudou:", event.data.isOnline);
      break;
  }
});
```

## 🔧 Configurações Avançadas

### Configuração Completa

```typescript
import { SyncEngine, SyncEngineConstants } from "sync-engine-lib";

const syncEngine = new SyncEngine({
  config: {
    serverUrl: "https://api.meuapp.com",
    batchSize: SyncEngineConstants.BATCH_SIZES.LARGE,
    syncInterval: SyncEngineConstants.SYNC_INTERVALS.FAST,
    maxRetries: 3,
    initialRetryDelay: SyncEngineConstants.RETRY_DELAYS.NORMAL,
    backoffMultiplier: 2,
    requestTimeout: SyncEngineConstants.TIMEOUTS.NORMAL,
    headers: {
      Authorization: "Bearer token",
      "X-App-Version": "1.0.0",
    },
  },
  conflictStrategy: ConflictStrategies.smartMerge(["id", "userId"]),
  debug: __DEV__,
  hooks: {
    onBeforeSync: async (items) => {
      // Validações antes do sync
      items.forEach((item) => {
        if (!item.payload.userId) {
          throw new Error("userId é obrigatório");
        }
      });
    },

    onSyncSuccess: async (items) => {
      // Cleanup ou notificações
      await analytics.track("sync_success", { count: items.length });
    },

    onSyncError: async (error, items) => {
      // Log de erro ou fallback
      await errorReporting.captureException(error);
    },

    onQueueChange: async (status) => {
      // Atualiza UI com status
      updateSyncStatus(status);
    },

    onConnectionChange: async (isOnline) => {
      // Notifica usuário sobre conectividade
      showConnectionStatus(isOnline);
    },
  },
});
```

## 🧪 Utilitários

```typescript
import { SyncEngineUtils, ConflictUtils } from "sync-engine-lib";

// Validação de configuração
const validation = SyncEngineUtils.validateConfig(config);
if (!validation.valid) {
  console.error("Configuração inválida:", validation.errors);
}

// Análise de conflitos
const hasChanges = ConflictUtils.hasSignificantChanges(localItem, serverItem);
const conflictType = ConflictUtils.identifyConflictType(localItem, serverItem);
const diffReport = ConflictUtils.createDiffReport(localItem, serverItem);
```

## 🏭 Factories

```typescript
import { SyncEngineFactory } from "sync-engine-lib";

// Desenvolvimento
const devEngine = SyncEngineFactory.createForDevelopment("https://api.dev.com");

// Produção
const prodEngine = SyncEngineFactory.createForProduction(
  "https://api.prod.com"
);

// Conservador (dados críticos)
const conservativeEngine =
  SyncEngineFactory.createConservative("https://api.com");

// Agressivo (sync rápido)
const aggressiveEngine = SyncEngineFactory.createAggressive("https://api.com");
```

## 🚧 Gerenciamento de Erros

```typescript
// Retry de items com erro
await syncEngine.retryFailedItems();

// Limpeza de items sincronizados
await syncEngine.clearSyncedItems();

// Status detalhado
const status = await syncEngine.getStatus();
if (status.errorItems > 0) {
  console.log(`${status.errorItems} items com erro`);
}
```

## 🔌 API do Servidor

Sua API deve responder no formato:

```typescript
// POST /sync
{
  "success": true,
  "data": { /* dados atualizados */ },
  "conflicts": [
    {
      "id": "item_id",
      "serverData": { /* versão do servidor */ },
      "conflictType": "version" // ou "concurrent", "deleted"
    }
  ]
}
```

## 📱 Integração com React Native

```typescript
// hooks/useSyncEngine.ts
import { useEffect, useState } from "react";
import { SyncEngineFactory } from "sync-engine-lib";

export const useSyncEngine = (serverUrl: string) => {
  const [syncEngine] = useState(() =>
    SyncEngineFactory.createForProduction(serverUrl)
  );
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const initSync = async () => {
      await syncEngine.initialize();
      await syncEngine.start();

      // Atualiza status
      const updateStatus = async () => {
        setStatus(await syncEngine.getStatus());
      };

      syncEngine.addEventListener(updateStatus);
      updateStatus();
    };

    initSync();

    return () => {
      syncEngine.destroy();
    };
  }, []);

  return { syncEngine, status };
};
```

## 🧩 Exemplos Práticos

### App de E-commerce

```typescript
// Produto adicionado ao carrinho offline
await syncEngine.addToQueue(SyncEngineUtils.generateId(), "cart_item", {
  productId: "123",
  quantity: 2,
  price: 29.99,
  addedAt: Date.now(),
});

// Pedido realizado offline
await syncEngine.addToQueue(SyncEngineUtils.generateId(), "order", {
  items: cartItems,
  total: 59.98,
  shippingAddress: address,
  createdAt: Date.now(),
});
```

### App de CRM

```typescript
// Contato criado offline
await syncEngine.addToQueue(SyncEngineUtils.generateId(), "contact", {
  name: "Cliente Novo",
  email: "cliente@email.com",
  phone: "+5511999999999",
  source: "mobile_app",
  createdAt: Date.now(),
});

// Atividade registrada
await syncEngine.addToQueue(SyncEngineUtils.generateId(), "activity", {
  contactId: "contact_123",
  type: "call",
  notes: "Ligação de follow-up",
  duration: 300,
  completedAt: Date.now(),
});
```

## 🔧 Troubleshooting

### Problemas Comuns

1. **Items não sincronizam**

   ```typescript
   // Verifica conectividade
   const status = await syncEngine.getStatus();
   if (!status.isOnline) {
     console.log("Sem conexão");
   }

   // Força sync manual
   await syncEngine.forceSync();
   ```

2. **Muitos conflitos**

   ```typescript
   // Use estratégia mais permissiva
   syncEngine.conflictResolver.setStrategy(ConflictStrategies.merge());
   ```

3. **Performance lenta**
   ```typescript
   // Reduza batch size
   const config = {
     ...currentConfig,
     batchSize: 5,
     syncInterval: 60000, // 1 minuto
   };
   ```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-feature`
3. Commit: `git commit -m 'Adiciona nova feature'`
4. Push: `git push origin feature/nova-feature`
5. Pull Request

## 📄 Licença

MIT

## 🙏 Créditos

Desenvolvido para React Native/Expo SDK 53 com TypeScript, SQLite e NetInfo.
