---
id: configuracao
title: Configuração
---

# Referência de Configuração

A `OfflineFirstEngine` é configurada através de um único objeto no seu construtor. Esta página detalha todas as opções disponíveis para que você possa ajustar o comportamento da biblioteca às necessidades do seu aplicativo.

## Estrutura Principal da Configuração

```typescript
import { OfflineFirstEngine } from "sync-engine-lib";

const engine = new OfflineFirstEngine({
  // (Obrigatório)
  adapter: MeuAdapter, 

  // (Obrigatório)
  entities: { /* ... */ },

  // (Opcional)
  storage: { /* ... */ },

  // (Opcional)
  sync: { /* ... */ },
});
```

---

## `adapter`

-   **Tipo:** `SyncAdapter`
-   **Obrigatório:** Sim

A ponte de comunicação com o seu backend. Você deve fornecer uma instância de uma classe que estende `SyncAdapter`.

**Exemplo com `RestAdapter`:**
```typescript
import { RestAdapter } from "sync-engine-lib";

const adapter = new RestAdapter({
  baseURL: "https://api.meuservidor.com/v1",
  headers: { "X-Api-Key": "SUA_CHAVE" },
});
```

**Exemplo com Adapter Customizado:**
```typescript
class MeuAdapter extends SyncAdapter { /* ... */ }

const adapter = new MeuAdapter();
```

---

## `entities`

-   **Tipo:** `Record<string, { schema: Record<string, "string" | "number" | "boolean" | "date" | "json"> }>`
-   **Obrigatório:** Sim

Define as tabelas de dados que a engine irá gerenciar. Cada chave do objeto é o nome de uma entidade.

```typescript
entities: {
  todos: {
    schema: {
      text: "string",
      completed: "boolean",
      priority: "string",
    },
  },
  users: {
    schema: {
      name: "string",
      age: "number",
      preferences: "json",
    },
  },
}
```
Para mais detalhes, veja a página **[Entidades e Schema](/docs/principais-conceitos/entidades-e-schema)**.

---

## `storage`

-   **Tipo:** `QueueStorageConfig`
-   **Obrigatório:** Não

Configurações relacionadas ao banco de dados SQLite.

-   `dbName` (string): O nome do arquivo do banco de dados.
    -   **Padrão:** `'offline_first.db'`

```typescript
storage: {
  dbName: 'meu_app.db',
}
```

---

## `sync`

-   **Tipo:** `BackgroundSyncConfig`
-   **Obrigatório:** Não

Configurações que controlam o comportamento do `BackgroundSyncWorker`.

-   `syncInterval` (number): O intervalo em milissegundos entre as tentativas de sincronização automática.
    -   **Padrão:** `30000` (30 segundos)

-   `batchSize` (number): O número máximo de operações a serem buscadas da fila para processar em um único ciclo de sync.
    -   **Padrão:** `10`

-   `maxRetries` (number): Número máximo de tentativas para uma operação que falhou com um erro "retryable".
    -   **Padrão:** `3`

-   `retryDelay` (number): O atraso inicial (em ms) para a primeira nova tentativa após uma falha.
    -   **Padrão:** `5000` (5 segundos)

-   `maxConcurrentOperations` (number): Quantas operações podem ser enviadas para o `SyncAdapter` em paralelo dentro de um lote.
    -   **Padrão:** `3`

```typescript
sync: {
  syncInterval: 60000, // 1 minuto
  batchSize: 25,
  maxRetries: 5,
}
```
