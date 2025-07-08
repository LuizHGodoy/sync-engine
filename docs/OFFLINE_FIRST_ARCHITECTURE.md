# Arquitetura Offline-First - Sync Engine

## Visão Geral da Arquitetura

```ts
┌─────────────────────────────────────────────────────────────────────┐
│                           APP LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  React Native / Expo App                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   UserList      │  │   UserForm      │  │   UserProfile   │     │
│  │   Component     │  │   Component     │  │   Component     │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│           │                     │                     │             │
│           ▼                     ▼                     ▼             │
├─────────────────────────────────────────────────────────────────────┤
│                        CRUD API LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    OfflineFirstDB                              │ │
│  │                                                                 │ │
│  │  async createUser(data) → { id, ...data, _status: 'pending' }  │ │
│  │  async getUsers() → User[]                                      │ │
│  │  async updateUser(id, data) → Updated User                     │ │
│  │  async deleteUser(id) → Success                                │ │
│  │                                                                 │ │
│  │  ✅ Sempre funciona (offline/online)                           │ │
│  │  ✅ Retorno imediato para UI                                   │ │
│  │  ✅ Sync automático em background                              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                │                                     │
├────────────────────────────────┼─────────────────────────────────────┤
│                                ▼                                     │
│                         LOCAL STORAGE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐           ┌─────────────────────────────────┐   │
│  │     ENTITIES    │           │           OUTBOX                │   │
│  │                 │           │                                 │   │
│  │ ┌─────────────┐ │           │ ┌─────────────────────────────┐ │   │
│  │ │ users       │ │           │ │ id: uuid                    │ │   │
│  │ │             │ │───────────▶ │ entity_table: 'users'       │ │   │
│  │ │ id          │ │  CREATE    │ │ entity_id: 'user-123'      │ │   │
│  │ │ name        │ │  UPDATE    │ │ operation: 'CREATE'        │ │   │
│  │ │ email       │ │  DELETE    │ │ data: {...userData}        │ │   │
│  │ │ _status     │ │           │ │ status: 'pending'          │ │   │
│  │ │ _server_id  │ │           │ │ created_at: timestamp      │ │   │
│  │ │ _version    │ │           │ │ retry_count: 0             │ │   │
│  │ └─────────────┘ │           │ │ next_retry: timestamp      │ │   │
│  └─────────────────┘           │ └─────────────────────────────┘ │   │
│                                │                                 │   │
│  ┌─────────────────┐           │ ┌─────────────────────────────┐ │   │
│  │     posts       │           │ │ id: uuid                    │ │   │
│  │                 │           │ │ entity_table: 'users'       │ │   │
│  │ id              │───────────▶ │ entity_id: 'user-456'      │ │   │
│  │ title           │  UPDATE    │ │ operation: 'UPDATE'        │ │   │
│  │ content         │           │ │ data: {name: 'New Name'}   │ │   │
│  │ user_id         │           │ │ status: 'syncing'          │ │   │
│  │ _status         │           │ │ created_at: timestamp      │ │   │
│  │ _server_id      │           │ │ retry_count: 1             │ │   │
│  │ _version        │           │ │ next_retry: timestamp      │ │   │
│  └─────────────────┘           │ └─────────────────────────────┘ │   │
│                                └─────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                          SYNC ENGINE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Background Sync Worker                      │ │
│  │                                                                 │ │
│  │  1. Monitora outbox (polling/triggers)                         │ │
│  │  2. Processa operações em lotes                                │ │
│  │  3. Chama APIs do servidor                                     │ │
│  │  4. Atualiza status (pending → synced/failed)                 │ │
│  │  5. Resolve conflitos automática/manualmente                  │ │
│  │  6. Retry com backoff exponencial                             │ │
│  │                                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                │                                     │
├────────────────────────────────┼─────────────────────────────────────┤
│                                ▼                                     │
│                         ADAPTER LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    SyncAdapter Interface                       │ │
│  │                                                                 │ │
│  │  abstract class SyncAdapter {                                  │ │
│  │    abstract create(table, data): Promise<ServerEntity>         │ │
│  │    abstract update(table, id, data): Promise<ServerEntity>     │ │
│  │    abstract delete(table, id): Promise<void>                   │ │
│  │    abstract fetchUpdates(table, since?): Promise<Entity[]>     │ │
│  │  }                                                              │ │
│  │                                                                 │ │
│  │  🔌 User implementa apenas este contrato                       │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│           │                     │                     │               │
│           ▼                     ▼                     ▼               │
├─────────────────────────────────────────────────────────────────────┤
│                           NETWORK LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   RestAdapter   │  │ GraphQLAdapter  │  │  CustomAdapter  │     │
│  │                 │  │                 │  │                 │     │
│  │ POST /api/users │  │ mutation {      │  │ // Qualquer     │     │
│  │ PUT /api/users  │  │   createUser    │  │ // protocolo    │     │
│  │ DELETE /users   │  │ }               │  │ // customizado  │     │
│  │ GET /api/users  │  │ query {         │  │                 │     │
│  │                 │  │   users         │  │                 │     │
│  └─────────────────┘  │ }               │  └─────────────────┘     │
│                       └─────────────────┘                          │
│                                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   Firebase      │  │    Supabase     │  │   Your Custom   │     │
│  │   Adapter       │  │    Adapter      │  │   API Adapter   │     │
│  │                 │  │                 │  │                 │     │
│  │ firestore       │  │ PostgreSQL      │  │ 🎯 SEU BACKEND  │     │
│  │ .collection()   │  │ .from('users')  │  │                 │     │
│  │ .add()          │  │ .insert()       │  │                 │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Fluxo de Uma Operação (Ex: Criar Usuário)

```ts
┌─────────────────┐
│ 1. User clicks  │
│ "Create User"   │
└─────────┬───────┘
          │
          ▼
┌─────────────────────────────────┐
│ 2. App calls:                   │
│ const user = await              │
│ offlineDB.createUser({          │
│   name: "João",                 │
│   email: "joao@email.com"       │
│ });                             │
└─────────┬───────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ 3. OfflineFirstDB:              │
│                                 │
│ A) Gera ID local: "user-abc123" │
│                                 │
│ B) Insere na tabela entities:   │
│    users: {                     │
│      id: "user-abc123",         │
│      name: "João",              │
│      email: "joao@email.com",   │
│      _status: "pending",        │
│      _server_id: null,          │
│      _version: 1                │
│    }                            │
│                                 │
│ C) Insere na tabela outbox:     │
│    {                            │
│      id: "op-xyz789",           │
│      entity_table: "users",     │
│      entity_id: "user-abc123",  │
│      operation: "CREATE",       │
│      data: {name: "João", ...}, │
│      status: "pending",         │
│      created_at: now(),         │
│      retry_count: 0             │
│    }                            │
│                                 │
│ D) Retorna user para UI         │
└─────────┬───────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ 4. UI recebe user imediatamente │
│ e atualiza a lista              │
│                                 │
│ ✅ User aparece instantaneamente│
│ 🟡 Com indicador "pending"      │
└─────────┬───────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ 5. Background Sync Worker       │
│ (roda independente da UI):      │
│                                 │
│ A) Detecta nova operação        │
│ B) Faz POST /api/users          │
│ C) Recebe resposta:             │
│    { id: "server-456", ... }    │
│                                 │
│ D) Atualiza entities:           │
│    users.id="user-abc123" →     │
│      _status: "synced",         │
│      _server_id: "server-456"   │
│                                 │
│ E) Atualiza outbox:             │
│    status: "synced"             │
└─────────┬───────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ 6. UI recebe evento de sync     │
│ e remove indicador "pending"    │
│                                 │
│ ✅ User agora está sincronizado │
└─────────────────────────────────┘
```

## Estados dos Dados

```ts
┌─────────────────┐  CREATE/UPDATE/DELETE   ┌─────────────────┐
│                 │ ────────────────────────▶│                 │
│    LOCAL        │                         │    PENDING      │
│                 │                         │                 │
│ _status: 'new'  │                         │ _status: 'pending'│
└─────────────────┘                         └─────────┬───────┘
                                                      │
                                                      │ Background Sync
                                                      ▼
┌─────────────────┐  Conflict Resolution    ┌─────────────────┐
│                 │ ◀────────────────────── │                 │
│   CONFLICTED    │                         │    SYNCING      │
│                 │                         │                 │
│_status: 'conflict'│                       │_status: 'syncing'│
└─────────────────┘                         └─────────┬───────┘
         │                                            │
         │ Manual/Auto Resolution                     │ Success
         ▼                                            ▼
┌─────────────────┐                         ┌─────────────────┐
│                 │                         │                 │
│    RESOLVED     │ ────────────────────────▶│     SYNCED      │
│                 │      Retry Sync         │                 │
│_status: 'pending'│                        │_status: 'synced'│
└─────────────────┘                         └─────────────────┘
```

## Estrutura das Tabelas SQLite

```sql
-- Tabela de entidades (ex: users)
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- ID local único
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,

  -- Metadados de sync
  _status TEXT DEFAULT 'new',       -- 'new', 'pending', 'syncing', 'synced', 'conflict'
  _server_id TEXT,                  -- ID no servidor após sync
  _version INTEGER DEFAULT 1,       -- Versão para controle de conflitos
  _created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  _updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  _deleted_at DATETIME              -- Soft delete
);

-- Fila de operações (outbox pattern)
CREATE TABLE outbox (
  id TEXT PRIMARY KEY,              -- UUID da operação
  entity_table TEXT NOT NULL,       -- 'users', 'posts', etc
  entity_id TEXT NOT NULL,          -- ID da entidade
  operation TEXT NOT NULL,          -- 'CREATE', 'UPDATE', 'DELETE'
  data TEXT,                        -- JSON com dados da operação

  -- Status de sync
  status TEXT DEFAULT 'pending',    -- 'pending', 'syncing', 'synced', 'failed'
  error_message TEXT,               -- Erro se houver

  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at DATETIME,

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Índices para performance
  FOREIGN KEY (entity_table, entity_id) REFERENCES entities(table, id)
);

-- Índices
CREATE INDEX idx_outbox_status ON outbox(status);
CREATE INDEX idx_outbox_retry ON outbox(next_retry_at) WHERE status = 'failed';
CREATE INDEX idx_entities_status ON users(_status);
```

## Como o Usuário Integra Seu Backend

### 🔌 1. Implementa o SyncAdapter

```typescript
// Exemplo: Adapter para sua API REST customizada
class MyAPIAdapter extends SyncAdapter {
  constructor(private baseURL: string, private apiKey: string) {
    super();
  }

  async create(table: string, data: any): Promise<ServerEntity> {
    const response = await fetch(`${this.baseURL}/${table}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async update(table: string, id: string, data: any): Promise<ServerEntity> {
    const response = await fetch(`${this.baseURL}/${table}/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async delete(table: string, id: string): Promise<void> {
    await fetch(`${this.baseURL}/${table}/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  async fetchUpdates(table: string, since?: Date): Promise<Entity[]> {
    const url = since
      ? `${this.baseURL}/${table}?updated_since=${since.toISOString()}`
      : `${this.baseURL}/${table}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.json();
  }
}
```

### 🎯 2. Configura a Engine

```typescript
// Usuário apenas conecta seu adapter
const myAdapter = new MyAPIAdapter("https://minha-api.com/api", "meu-token");

const offlineDB = new OfflineFirstDB({
  syncAdapter: myAdapter,
  entities: {
    users: {
      schema: {
        name: "string",
        email: "string",
        age: "number",
      },
    },
    posts: {
      schema: {
        title: "string",
        content: "string",
        user_id: "string",
      },
    },
  },
});

// Pronto! Agora funciona com SEU backend
const user = await offlineDB.createUser({
  name: "João",
  email: "joao@email.com",
});
```

### 🔄 3. Adapters Pré-construídos

```typescript
// Para APIs populares, fornecemos adapters prontos
import {
  RestAdapter, // APIs REST genéricas
  GraphQLAdapter, // GraphQL
  FirebaseAdapter, // Firebase/Firestore
  SupabaseAdapter, // Supabase
  PrismaAdapter, // Prisma ORM
} from "sync-engine-lib/adapters";

// Exemplo: Firebase
const firebaseAdapter = new FirebaseAdapter({
  apiKey: "sua-api-key",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
});

// Exemplo: GraphQL
const graphqlAdapter = new GraphQLAdapter({
  endpoint: "https://api.exemplo.com/graphql",
  headers: {
    Authorization: "Bearer token",
  },
});

// Exemplo: REST genérico
const restAdapter = new RestAdapter({
  baseURL: "https://api.exemplo.com",
  headers: {
    "X-API-Key": "sua-chave",
  },
});
```

## A Lib É Completamente Agnóstica 🎯

### ✅ O que a Lib Gerencia

- **Local Storage**: SQLite + Outbox Pattern
- **Sync Logic**: Retry, conflitos, batch operations
- **UI State**: pending, synced, conflict status
- **Background Jobs**: Quando e como sincronizar

### 🔌 O que o Usuário Implementa

- **Network Calls**: Como chamar SEU backend
- **Data Mapping**: Como transformar seus dados
- **Authentication**: Como autenticar com SUA API
- **Error Handling**: Como tratar erros específicos do SEU servidor

### 🎨 Flexibilidade Total

```typescript
// Pode ser REST
const adapter = new RestAdapter(config);

// Pode ser GraphQL
const adapter = new GraphQLAdapter(config);

// Pode ser Firebase
const adapter = new FirebaseAdapter(config);

// Pode ser WebSocket
const adapter = new WebSocketAdapter(config);

// Pode ser qualquer coisa customizada
class MeuProtocoloExoticoAdapter extends SyncAdapter {
  // Implementa seu protocolo específico
}
```

## Vantagens Desta Separação

### ✅ Para a Lib

- **Zero vendor lock-in**: Funciona com qualquer backend
- **Testável**: Pode mockar adapters facilmente
- **Evolutiva**: Novos adapters sem quebrar a lib
- **Focada**: Só cuida do que é dela (sync + offline)

### ✅ Para o Usuário

- **Flexibilidade**: Usa o backend que quiser
- **Migração fácil**: Trocar backend = trocar adapter
- **Customização**: Controle total sobre network layer
- **Gradual**: Pode implementar adapter incrementalmente

### ✅ Para o Ecossistema

- **Comunidade**: Adapters podem ser open source
- **Reutilização**: Um adapter serve para múltiplos projetos
- **Especialização**: Adapters otimizados por tecnologia
- **Inovação**: Novos backends = novos adapters

## Fluxo Completo com Adapter

```ts
┌─────────────────┐
│ UI: createUser  │
└─────────┬───────┘
          │
          ▼
┌─────────────────────────────────┐
│ OfflineFirstDB:                 │
│ 1. Salva local (SQLite)         │
│ 2. Adiciona na outbox           │
│ 3. Retorna user imediatamente   │
└─────────┬───────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ Background Sync Worker:         │
│ 1. Pega operação da outbox      │
│ 2. Chama adapter.create()       │
│                                 │
│    ┌─────────────────────────┐  │
│    │ SEU ADAPTER decide:     │  │
│    │                         │  │
│    │ REST: POST /api/users   │  │
│    │ GraphQL: mutation {...} │  │
│    │ Firebase: doc.add()     │  │
│    │ Custom: qualquer coisa  │  │
│    └─────────────────────────┘  │
│                                 │
│ 3. Recebe resposta do servidor  │
│ 4. Atualiza local + outbox      │
└─────────┬───────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ UI recebe evento de sync        │
│ ✅ User sincronizado            │
└─────────────────────────────────┘
```
