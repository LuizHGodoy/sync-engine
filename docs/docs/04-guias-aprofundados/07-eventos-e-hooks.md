---
id: eventos-e-hooks
title: Eventos e UI Reativa
---

# Eventos e UI Reativa

Uma parte crucial de um aplicativo offline-first é garantir que a interface do usuário (UI) reflita o estado atual dos dados de forma reativa. Quando um item é criado, ele deve aparecer na tela instantaneamente. Quando seu status de sincronização muda de `pending` para `synced`, a UI deve atualizar para remover o indicador de "pendente".

A `sync-engine-lib` foi construída com um sistema de eventos para facilitar essa reatividade.

## Ouvindo Eventos da Tabela

A maneira mais comum de ouvir mudanças é registrar um "listener" em um manipulador de tabela específico. O método `table('nome')` retorna um objeto que possui os métodos `on()` e `off()`.

```typescript
const engine = new OfflineFirstEngine(/* ... */);
await engine.initialize();

const todosTable = engine.table('todos');

const meuListener = (itemModificado) => {
  console.log('Algo mudou na tabela de todos!', itemModificado);
  // Aqui você atualizaria o estado da sua UI (ex: com React.useState)
};

// Ouvindo o evento 'changed', que é disparado para create, update e delete.
todosTable.on('changed', meuListener);

// Para parar de ouvir (importante para evitar memory leaks em componentes React)
// todosTable.off('changed', meuListener);
```

### Tipos de Eventos de Tabela:

-   **`created`**: Disparado quando um novo item é criado com `table.create()`. O dado passado para o listener é o novo item.
-   **`updated`**: Disparado quando um item é atualizado com `table.update()`. O dado é o item atualizado.
-   **`deleted`**: Disparado quando um item é deletado com `table.delete()`. O dado é um objeto `{ id, _deleted_at }`.
-   **`changed`**: Um evento genérico que é disparado para qualquer uma das três operações acima. É o mais útil para simplesmente recarregar uma lista de dados.

### Exemplo com React (`useTodos` hook)

O hook `useTodos` do nosso [Guia Rápido](/docs/guia-rapido/construindo-um-app-de-todos) é um exemplo perfeito de como usar eventos para criar uma UI reativa.

```typescript title="lib/hooks.ts"
export const useTodos = (engine, isInitialized) => {
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    if (!engine || !isInitialized) return;

    const todosTable = engine.table("todos");

    // Função para recarregar os dados do banco
    const loadTodos = async () => {
      const allTodos = await todosTable.findAll({ orderBy: "_created_at", order: "DESC" });
      setTodos(allTodos);
    };

    // Carrega os dados inicialmente
    loadTodos();

    // Registra o listener. Sempre que algo mudar, recarrega os dados.
    todosTable.on("changed", loadTodos);

    // Função de limpeza: remove o listener quando o componente desmontar.
    return () => {
      todosTable.off("changed", loadTodos);
    };
  }, [engine, isInitialized]);

  // ... resto do hook
  return { todos, ... };
};
```

## Ouvindo Eventos Globais do Worker

Se você precisa de um controle mais fino sobre o processo de sincronização em si, pode ouvir os eventos diretamente do `BackgroundSyncWorker`.

```typescript
const worker = engine.worker;

worker.addEventListener((event) => {
  console.log(`[Sync Worker Event] Tipo: ${"$"}{event.type}`);

  switch (event.type) {
    case 'sync_started':
      console.log('Worker iniciou um ciclo de sincronização.');
      break;
    case 'operation_synced':
      console.log(`Operação ${"$"}{event.data.operation.id} sincronizada com sucesso!`);
      break;
    case 'operation_failed':
      console.error(`Operação ${"$"}{event.data.operation.id} falhou:`, event.data.error);
      break;
    case 'sync_completed':
      console.log('Ciclo de sincronização concluído.');
      break;
  }
});
```

Isso é útil para depuração, logging ou para exibir um indicador de status de sincronização global no seu aplicativo.
