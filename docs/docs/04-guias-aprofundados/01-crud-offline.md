---
id: crud-offline
title: Operações CRUD Offline
---

# Operações CRUD Offline

O principal benefício da `OfflineFirstEngine` é fornecer uma API de banco de dados que funciona de forma idêntica, esteja o usuário online ou offline. Todas as operações são executadas instantaneamente no banco de dados local (SQLite), garantindo uma experiência de usuário rápida e fluida.

## Acessando uma Tabela

Para realizar operações em uma entidade, você primeiro obtém um "manipulador de tabela" (table handler) a partir da sua instância da engine:

```typescript
const engine = new OfflineFirstEngine(/* ... */);
await engine.initialize();

// Obtém o manipulador para a entidade 'todos'
const todosTable = engine.table('todos');
```

Este objeto `todosTable` contém todos os métodos que você precisa para interagir com os dados daquela entidade.

## Criar (`create`)

Para criar um novo registro, use o método `create`. Ele recebe um objeto com os dados do novo item (sem os campos de metadados).

A função retorna o objeto completo que foi inserido no banco de dados, incluindo o `id` local gerado e os metadados de sincronização (`_status: 'pending'`).

```typescript
async function adicionarNovaTarefa(texto: string) {
  console.log("Adicionando tarefa...");

  const novaTarefa = await todosTable.create({
    text: texto,
    completed: false,
    priority: 'medium',
    tags: ['pessoal']
  });

  console.log("Tarefa criada localmente:", novaTarefa);
  // Exemplo de output:
  // {
  //   id: 'local_1678886400000_abcdef',
  //   text: 'Comprar pão',
  //   completed: false,
  //   priority: 'medium',
  //   tags: ['pessoal'],
  //   _status: 'pending',
  //   _version: 1,
  //   /* ... outros metadados ... */
  // }
}
```

## Ler (`findAll`, `findById`)

Existem dois métodos principais para ler dados:

### `findAll(options)`

Busca múltiplos registros. É altamente configurável.

```typescript
// Buscar todos os todos não deletados, ordenados pelos mais recentes
const todosRecentes = await todosTable.findAll({
  orderBy: '_created_at',
  order: 'DESC'
});

// Buscar todos os todos incompletos com prioridade alta, com limite de 10
const todosUrgentes = await todosTable.findAll({
  where: {
    completed: false,
    priority: 'high'
  },
  limit: 10
});
```

**Opções do `findAll`:**
- `where`: Um objeto para filtrar os resultados.
- `orderBy`: O nome do campo pelo qual ordenar.
- `order`: A direção da ordenação, `'ASC'` ou `'DESC'`.
- `limit`: Número máximo de registros a retornar.
- `offset`: Posição inicial para a busca (útil para paginação).
- `includeDeleted`: Se `true`, inclui registros marcados como deletados.

### `findById(id)`

Busca um único registro pelo seu `id` local.

```typescript
const tarefaEspecifica = await todosTable.findById('local_1678886400000_abcdef');

if (tarefaEspecifica) {
  console.log("Tarefa encontrada:", tarefaEspecifica.text);
}
```

## Atualizar (`update`)

Para modificar um registro existente, use `update`. Ele recebe o `id` do registro e um objeto com os campos a serem alterados.

```typescript
async function completarTarefa(id: string) {
  const tarefaAtualizada = await todosTable.update(id, {
    completed: true
  });

  console.log("Status da tarefa atualizado para:", tarefaAtualizada.completed);
}
```

A operação de `update` também coloca uma nova entrada na fila de sincronização e atualiza o `_status` do item para `pending`.

## Deletar (`delete`)

Para remover um registro, use `delete` com o `id` do item.

Por padrão, a biblioteca realiza um **soft delete**: o registro não é removido do banco de dados, mas o campo `_deleted_at` é preenchido com um timestamp. Isso garante que a operação de exclusão possa ser sincronizada com o servidor.

```typescript
async function removerTarefa(id: string) {
  const sucesso = await todosTable.delete(id);

  if (sucesso) {
    console.log(`Tarefa ${"$"}{id} marcada para exclusão.`);
  }
}
```

Registros deletados não aparecerão nos resultados de `findAll` a menos que você especifique a opção `{ includeDeleted: true }`.
