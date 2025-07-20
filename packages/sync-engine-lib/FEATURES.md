# Sync Engine Lib - Visão Geral de Features

Esta biblioteca fornece uma solução completa para sincronização de dados offline-first em aplicações React Native, com suporte a múltiplas estratégias de sincronização, resolução de conflitos, fila de operações, monitoramento de rede, políticas de retry, background sync e integração com banco local SQLite.

## Principais Features

- **Sincronização Offline-First**: Permite que operações sejam feitas offline e sincronizadas automaticamente quando a conexão for restabelecida.
- **Fila de Operações (Outbox)**: Todas as operações (CREATE, UPDATE, DELETE) são enfileiradas e persistidas até serem sincronizadas com o servidor.
- **Resolução de Conflitos**: Suporte a múltiplas estratégias (client-wins, server-wins, timestamp, merge, manual, etc).
- **Monitoramento de Rede**: Detecta mudanças de conectividade e dispara sincronizações automáticas.
- **Políticas de Retry**: Estratégias configuráveis de retry com backoff exponencial e jitter.
- **Sincronização em Background**: Suporte a background sync usando Expo, React Native Background Job ou fallback por timer.
- **Adapters**: Abstração para integração com diferentes APIs (REST, custom, etc).
- **Banco Local (SQLite)**: Persistência local de entidades e metadados de sincronização.
- **Hooks e Eventos**: Callbacks para monitorar e customizar o ciclo de vida da sincronização.

---

## Exemplos de Uso

### 1. Inicialização Básica do SyncEngine

```typescript
import { SyncEngine, SyncEngineUtils } from "sync-engine-lib";

const syncEngine = new SyncEngine({
  config: SyncEngineUtils.createDefaultConfig("https://api.meuservidor.com"),
  debug: true,
});

await syncEngine.initialize();
syncEngine.start();
```

### 2. Adicionando Operações à Fila

```typescript
await syncEngine.addToQueue("id123", "users", { nome: "João", idade: 30 });
```

### 3. Forçando Sincronização Manual

```typescript
await syncEngine.forceSync();
```

### 4. Resolução de Conflitos

```typescript
import { ConflictStrategies } from 'sync-engine-lib';

const syncEngine = new SyncEngine({
  config: ..., // config
  conflictStrategy: ConflictStrategies.timestampWins(),
});
```

### 5. Monitoramento de Rede

```typescript
import { NetMonitor } from "sync-engine-lib";

const netMonitor = new NetMonitor();
await netMonitor.initialize();
console.log(netMonitor.getConnectionStatus());
```

### 6. Uso do OfflineFirstEngine (CRUD offline + sync)

```typescript
import { OfflineFirstEngine } from "sync-engine-lib";

const engine = new OfflineFirstEngine({
  adapter: { type: "rest", baseURL: "https://api.meuservidor.com" },
  entities: {
    users: { schema: { nome: "string", idade: "number" } },
  },
});
await engine.initialize();

// CRUD offline
await engine.table("users").create({ nome: "Maria", idade: 25 });
const users = await engine.table("users").findAll();

// Sincronizar
await engine.forceSync();
```

### 7. Background Sync

```typescript
import { addBackgroundSyncToEngine } from "sync-engine-lib";

const engineWithBg = addBackgroundSyncToEngine(syncEngine);
await engineWithBg.enableBackgroundSync({ interval: 60000 });
```

### 8. Políticas de Retry

```typescript
import { RetryPolicies } from "sync-engine-lib";

const retryPolicy = RetryPolicies.aggressive();
```

### 9. Adapters Customizados

```typescript
import { SyncAdapter } from "sync-engine-lib";

class MyCustomAdapter extends SyncAdapter {
  // implemente create, update, delete, fetchUpdates
}
```

---

## Resumo das Principais Classes

- **SyncEngine**: Núcleo de sincronização, gerencia fila, status, hooks e eventos.
- **OfflineFirstEngine**: Abstração para CRUD offline-first, integra fila, banco local e sync.
- **QueueStorage**: Persistência da fila de operações (outbox) em SQLite.
- **NetMonitor**: Monitoramento de conectividade.
- **RetryPolicy**: Estratégias de retry configuráveis.
- **ConflictResolver/ConflictStrategies**: Estratégias de resolução de conflitos.
- **BackgroundSyncManager**: Sincronização em background.
- **SyncAdapter/RestAdapter**: Abstração para integração com APIs.

---

## Documentação Completa

Esta lib possui documentação completa desenvolvida com Docusaurus, incluindo:

- **API Reference**: Documentação detalhada de todas as classes e métodos
- **Guias Práticos**: Tutoriais passo-a-passo para diferentes cenários
- **Exemplos Completos**: Apps de exemplo (Todo, Chat, E-commerce)
- **Playground Interativo**: Teste a lib diretamente no navegador
- **Troubleshooting**: Soluções para problemas comuns
- **Migration Guides**: Guias de migração entre versões

Acesse a documentação completa em: [Link da documentação]

---

## Observações

- Consulte a documentação dos tipos e interfaces para customização avançada.
- Use hooks e eventos para monitorar e customizar o ciclo de vida da sincronização.
- A biblioteca é extensível para diferentes cenários offline-first.

---

Para detalhes completos, consulte os arquivos de código-fonte e os exemplos acima.
