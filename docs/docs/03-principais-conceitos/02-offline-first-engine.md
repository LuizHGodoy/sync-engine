---
id: offline-first-engine
title: OfflineFirstEngine
---

# O Coração da Biblioteca: OfflineFirstEngine

A `OfflineFirstEngine` é a principal classe e o ponto de entrada que você usará na maior parte do tempo. Ela foi projetada para ser uma fachada (facade) que orquestra todos os componentes complexos da biblioteca, oferecendo uma API simples e poderosa para você.

## O que a Engine Gerencia para Você?

Ao criar uma instância da `OfflineFirstEngine`, ela automaticamente configura e gerencia:

-   **`OfflineFirstDB`**: A camada de banco de dados local (SQLite) onde seus dados de entidades são armazenados.
-   **`QueueStorage`**: A fila de operações (Outbox) que rastreia todas as alterações que precisam ser sincronizadas.
-   **`BackgroundSyncWorker`**: O worker que processa a fila e envia os dados para o servidor.
-   **`NetMonitor`**: O monitor de conectividade de rede.
-   **`SyncAdapter`**: A ponte de comunicação entre a engine e o seu backend.

Você configura a engine uma vez, e ela cuida de todo o fluxo de dados e sincronização.

## Configuração

Você instancia a engine com um objeto de configuração que define seu comportamento.

```typescript
import { OfflineFirstEngine } from "sync-engine-lib";

const engine = new OfflineFirstEngine({
  // 1. O Adapter para conectar ao seu backend
  adapter: new MyRestAdapter("https://api.meusite.com"),

  // 2. A definição das suas entidades de dados
  entities: {
    todos: {
      schema: {
        text: "string",
        completed: "boolean",
      },
    },
    // ... outras entidades
  },

  // 3. Configurações opcionais de sincronização
  sync: {
    syncInterval: 30000, // 30 segundos
    batchSize: 20,
  },
});
```

### Principais Propriedades da Configuração:

-   `adapter`: Uma instância de uma classe que estende `SyncAdapter`. É **obrigatório** e define como a engine se comunica com seu servidor.
-   `entities`: Um objeto onde cada chave é o nome de uma entidade (ex: 'todos', 'posts') e o valor contém o `schema` dos dados. É **obrigatório**.
-   `sync`: Um objeto opcional para ajustar o comportamento do `BackgroundSyncWorker`, como o intervalo entre as sincronizações (`syncInterval`) e o tamanho dos lotes (`batchSize`).

## Ciclo de Vida da Engine

A engine tem um ciclo de vida simples que você controla:

1.  **Instanciação**: `const engine = new OfflineFirstEngine(config);`
    - Neste ponto, a engine está configurada, mas ainda não interagiu com o banco de dados ou a rede.

2.  **Inicialização**: `await engine.initialize();`
    - Este método **precisa** ser chamado antes de qualquer outra operação.
    - Ele abre a conexão com o banco de dados SQLite, cria as tabelas necessárias para suas entidades e para a fila (outbox), e inicializa o monitor de rede.

3.  **Início**: `await engine.start();`
    - Este método "liga" o `BackgroundSyncWorker`. A partir deste momento, a engine começará a processar a fila de operações e a sincronizar com o servidor em intervalos regulares, sempre que houver conexão.

4.  **Fechamento**: `await engine.close();`
    - É importante chamar este método quando seu aplicativo está sendo fechado (por exemplo, no `useEffect` de desmontagem do seu componente raiz).
    - Ele para o worker de sincronização e fecha a conexão com o banco de dados de forma segura.

## Acessando os Componentes

A instância da `OfflineFirstEngine` fornece acesso direto aos seus componentes internos, caso você precise de um controle mais granular:

-   `engine.database`: Acesso à instância do `OfflineFirstDB` para interagir diretamente com o banco de dados.
-   `engine.worker`: Acesso ao `BackgroundSyncWorker` para, por exemplo, ouvir eventos específicos do worker.
-   `engine.network`: Acesso ao `NetMonitor` para verificar o status da conexão.
-   `engine.storage`: Acesso direto ao `QueueStorage` (a fila de operações).

Na maioria dos casos, você não precisará acessar esses componentes diretamente, pois a API principal, `engine.table('nome')`, já oferece tudo o que é necessário para o CRUD offline.
