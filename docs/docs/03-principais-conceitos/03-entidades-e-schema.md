---
id: entidades-e-schema
title: Entidades e Schema
---

## Entidades e Schema

No contexto da `sync-engine-lib`, uma **Entidade** representa um tipo de dado que você deseja armazenar localmente e sincronizar. Pense nela como um "modelo" ou uma "tabela" em um banco de dados tradicional. Por exemplo, em um app de tarefas, `todo` seria uma entidade. Em um app de blog, `post` e `comment` seriam entidades.

## Definindo Entidades na Configuração

Você define todas as entidades do seu aplicativo na propriedade `entities` ao configurar a `OfflineFirstEngine`.

```typescript
const engine = new OfflineFirstEngine({
  adapter: /* ... */,
  entities: {
    // A chave 'todos' é o nome da sua entidade
    todos: {
      // O 'schema' descreve os campos desta entidade
      schema: {
        text: "string",
        completed: "boolean",
        priority: "string",
        dueDate: "date",
        tags: "json",
      },
    },
    // Você pode definir múltiplas entidades
    categories: {
      schema: {
        name: "string",
        color: "string",
      },
    },
  },
});
```

Quando você chama `await engine.initialize()`, a biblioteca lê essa configuração e cria automaticamente as tabelas correspondentes no banco de dados SQLite local.

## O Schema

O `schema` é um objeto que descreve os campos (ou colunas) da sua entidade. A chave é o nome do campo, e o valor é o tipo de dado.

### Tipos de Campo Suportados

A biblioteca suporta os seguintes tipos de schema, que são mapeados para os tipos de dados do SQLite:

| Tipo no Schema | Tipo no SQLite | Descrição                                                                                               | Exemplo de Valor          |
| :------------- | :------------- | :------------------------------------------------------------------------------------------------------ | :------------------------ |
| **`string`**   | `TEXT`         | Para armazenar textos de qualquer tamanho.                                                              | `'Comprar leite'`         |
| **`number`**   | `REAL`         | Para armazenar números, incluindo inteiros e decimais.                                                  | `42`, `3.14`              |
| **`boolean`**  | `INTEGER`      | Para armazenar valores verdadeiros ou falsos. São armazenados como `1` (true) ou `0` (false).           | `true`, `false`           |
| **`date`**     | `INTEGER`      | Para armazenar datas. As datas são convertidas para o formato de timestamp UNIX (milissegundos).        | `new Date()`              |
| **`json`**     | `TEXT`         | Para armazenar objetos ou arrays complexos. O valor é serializado para uma string JSON antes de salvar. | `['pessoal', 'trabalho']` |

### Campos de Metadados Adicionados Automaticamente

Além dos campos que você define no `schema`, a `sync-engine-lib` adiciona automaticamente alguns campos de metadados a cada registro. Esses campos são prefixados com `_` e são essenciais para o funcionamento da sincronização.

- `id` (TEXT): Um ID único local gerado pela biblioteca.
- `_status` (TEXT): O estado de sincronização do registro (`new`, `pending`, `synced`, etc.).
- `_server_id` (TEXT): O ID do registro no servidor, preenchido após a primeira sincronização bem-sucedida.
- `_version` (INTEGER): Um número de versão que é incrementado a cada atualização, usado para resolução de conflitos.
- `_created_at` (INTEGER): Timestamp de quando o registro foi criado localmente.
- `_updated_at` (INTEGER): Timestamp da última atualização local.
- `_deleted_at` (INTEGER): Timestamp de quando o registro foi marcado para exclusão (soft delete).

Você não precisa (e não deve) definir esses campos no seu `schema`. Eles são gerenciados internamente. No entanto, você terá acesso a eles ao ler os dados, o que é útil para, por exemplo, exibir um indicador de status na UI.

```typescript
const todos = await engine.table("todos").findAll();
const primeiroTodo = todos[0];

console.log(primeiroTodo.text); // 'Comprar leite'
console.log(primeiroTodo._status); // 'synced'
console.log(primeiroTodo._version); // 2
```
