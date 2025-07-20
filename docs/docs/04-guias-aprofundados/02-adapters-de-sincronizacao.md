---
id: adapters-de-sincronizacao
title: Adapters de Sincronização
---

## Adapters de Sincronização

Um **Adapter** é a ponte entre a `sync-engine-lib` e o seu backend. Ele define um contrato claro sobre como as operações de Create, Update, Delete e Fetch devem ser executadas na rede. Essa arquitetura torna a biblioteca completamente agnóstica em relação à sua API.

## O Contrato: `SyncAdapter`

Qualquer adapter que você criar deve estender a classe abstrata `SyncAdapter` e implementar seus métodos.

```typescript
export abstract class SyncAdapter {
  // Cria um registro no servidor
  abstract create(table: string, data: any): Promise<SyncResult>;

  // Atualiza um registro no servidor
  abstract update(table: string, id: string, data: any): Promise<SyncResult>;

  // Deleta um registro no servidor
  abstract delete(table: string, id: string): Promise<SyncResult>;

  // Busca atualizações do servidor
  abstract fetchUpdates(
    table: string,
    options?: FetchOptions
  ): Promise<{
    entities: ServerEntity[];
    hasMore: boolean;
    nextOffset?: number;
  }>;

  // (Opcional) Valida a conexão com o servidor
  async validateConnection(): Promise<boolean>;
}
```

### O Objeto `SyncResult`

Os métodos `create`, `update` e `delete` devem retornar uma `Promise` que resolve para um objeto `SyncResult`. Este objeto informa à engine se a operação foi bem-sucedida.

```typescript
export interface SyncResult {
  success: boolean;
  data?: ServerEntity; // Dados retornados pelo servidor (ex: com o server_id)
  error?: {
    code: string;
    message: string;
    retryable: boolean; // A engine deve tentar novamente?
  };
}
```

- Se `success` for `true`, a engine marca a operação como `synced`.
- Se `success` for `false` e `error.retryable` for `true`, a engine marca a operação como `failed` e a tentará novamente mais tarde.
- Se `success` for `false` e `error.retryable` for `false`, a operação é marcada como `failed` permanentemente.

## Usando o `RestAdapter` (Embutido)

Para facilitar a integração com APIs REST padrão, a biblioteca já inclui um `RestAdapter`.

**Configuração:**

```typescript
import { OfflineFirstEngine, RestAdapter } from "sync-engine-lib";

const restAdapter = new RestAdapter({
  baseURL: "https://api.meuservidor.com/v1",
  headers: {
    "X-Api-Key": "SUA_CHAVE_DE_API",
  },
  auth: {
    type: "bearer",
    token: "SEU_TOKEN_JWT",
  },
});

const engine = new OfflineFirstEngine({
  adapter: restAdapter,
  entities: {
    /* ... */
  },
});
```

O `RestAdapter` faz as seguintes chamadas HTTP por padrão:

- **Create**: `POST /<tabela>`
- **Update**: `PUT /<tabela>/<id>`
- **Delete**: `DELETE /<tabela>/<id>`
- **Fetch**: `GET /<tabela>`

## Criando um Adapter Customizado

Se o seu backend não segue as convenções REST ou usa outro protocolo (como GraphQL ou WebSockets), você pode facilmente criar seu próprio adapter.

Vamos ver o exemplo do `DemoRestAdapter` usado no `demo-app`, que é um ótimo ponto de partida.

```typescript
import { SyncAdapter, SyncResult, ServerEntity } from "sync-engine-lib";

class MeuAdapterCustomizado extends SyncAdapter {
  private apiClient: any; // Sua instância de cliente de API, ex: Axios

  constructor() {
    super();
    // Inicialize seu cliente de API aqui
    this.apiClient = new ApiClient("https://minha-api.com");
  }

  async create(table: string, data: any): Promise<SyncResult> {
    try {
      // Lógica para chamar sua API de criação
      const response = await this.apiClient.post(`/${"$"}{table}`, data);

      // Retorna um resultado de sucesso com os dados do servidor
      return { success: true, data: response.data as ServerEntity };
    } catch (error: any) {
      // Retorna um erro, indicando se a engine deve tentar novamente
      return {
        success: false,
        error: {
          code: error.code || "CREATE_ERROR",
          message: error.message,
          retryable: error.isNetworkError, // Tentar novamente em caso de erro de rede
        },
      };
    }
  }

  async update(table: string, id: string, data: any): Promise<SyncResult> {
    // ... lógica para a chamada de atualização ...
  }

  async delete(table: string, id: string): Promise<SyncResult> {
    // ... lógica para a chamada de deleção ...
  }

  async fetchUpdates(
    table: string
  ): Promise<{ entities: ServerEntity[]; hasMore: boolean }> {
    // ... lógica para buscar atualizações do servidor ...
  }
}
```

Com um adapter customizado, você tem controle total sobre:

- Os endpoints e métodos HTTP.
- O formato do corpo da requisição (`body`).
- Como a autenticação é tratada.
- Como as respostas de sucesso e erro do seu backend são mapeadas para o `SyncResult`.
