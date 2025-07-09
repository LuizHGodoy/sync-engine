---
id: construindo-um-app-de-todos
title: Guia Rápido
---

# Guia Rápido: Construindo um App de Tarefas

Neste guia, vamos criar um aplicativo de lista de tarefas (To-Do) totalmente funcional e offline-first em menos de 10 minutos. Vamos usar a `OfflineFirstEngine` para gerenciar nossos dados.

O resultado será um app onde você pode adicionar, editar e deletar tarefas, com todas as alterações funcionando offline e sincronizando automaticamente com o servidor.

## Passo 1: Criar a Instância da Engine

O primeiro passo é configurar e criar uma instância da `OfflineFirstEngine`. Esta será a peça central do nosso sistema. Crie um arquivo `lib/offlineEngine.ts` no seu projeto.

```typescript title="lib/offlineEngine.ts"
import { OfflineFirstEngine, SyncAdapter, SyncResult, ServerEntity, FetchOptions } from "sync-engine-lib";

// Para este exemplo, vamos criar um Adapter de teste que simula uma API REST.
// Em um projeto real, você implementaria a lógica para chamar seu backend.
class DemoRestAdapter extends SyncAdapter {
  private baseURL: string;

  constructor(baseURL: string) {
    super();
    this.baseURL = baseURL;
  }

  // Implementação simplificada para o guia
  async create(table: string, data: any): Promise<SyncResult> {
    console.log(`[Adapter] CREATE em ${"$"}{table}:`, data);
    // Simula uma resposta de sucesso do servidor
    return Promise.resolve({ success: true, data: { id: `server_${"$"}{Date.now()}`, ...data } });
  }
  async update(table: string, id: string, data: any): Promise<SyncResult> {
    console.log(`[Adapter] UPDATE em ${"$"}{table}/${"$"}{id}:`, data);
    return Promise.resolve({ success: true, data: { id, ...data } });
  }
  async delete(table: string, id: string): Promise<SyncResult> {
    console.log(`[Adapter] DELETE em ${"$"}{table}/${"$"}{id}`);
    return Promise.resolve({ success: true });
  }
  async fetchUpdates(table: string, options: FetchOptions): Promise<{ entities: ServerEntity[]; hasMore: boolean; }> {
    console.log(`[Adapter] FETCH para ${"$"}{table}`);
    return Promise.resolve({ entities: [], hasMore: false });
  }
}

// Função que cria e configura nossa engine
export const createOfflineEngine = () => {
  // 1. Crie uma instância do seu adapter
  const adapter = new DemoRestAdapter("http://localhost:4000");

  // 2. Crie a instância da OfflineFirstEngine
  return new OfflineFirstEngine({
    adapter,
    // 3. Defina as "entidades" (tabelas) e seus schemas
    entities: {
      todos: {
        schema: {
          text: "string",
          completed: "boolean",
          priority: "string", // 'low', 'medium', 'high'
          tags: "json",
        },
      },
    },
    // 4. (Opcional) Configure o worker de sincronização
    sync: {
      syncInterval: 15000, // Sincroniza a cada 15 segundos
      batchSize: 10,
    },
  });
};
```

## Passo 2: Criar um Hook React para Usar a Engine

Agora, vamos criar um hook customizado para gerenciar o ciclo de vida da engine e fornecer acesso fácil aos nossos dados de `todos`. Crie o arquivo `lib/hooks.ts`.

```typescript title="lib/hooks.ts"
import { useEffect, useRef, useState } from "react";
import { OfflineFirstEngine } from "sync-engine-lib";
import { createOfflineEngine } from "./offlineEngine";

// Hook para gerenciar a instância da engine
export const useOfflineEngine = () => {
  const engineRef = useRef<OfflineFirstEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (engineRef.current) return;

      const engine = createOfflineEngine();
      engineRef.current = engine;

      // Inicializa e inicia a engine
      await engine.initialize();
      await engine.start();

      setIsInitialized(true);
    };

    init();

    return () => {
      engineRef.current?.close();
    };
  }, []);

  return { engine: engineRef.current, isInitialized };
};

// Hook para interagir com a tabela de 'todos'
export const useTodos = (engine: OfflineFirstEngine | null, isInitialized: boolean) => {
  const [todos, setTodos] = useState<any[]>([]);

  // Carrega os todos e ouve as mudanças
  useEffect(() => {
    if (!engine || !isInitialized) return;

    const todosTable = engine.table("todos");

    const loadTodos = async () => {
      const allTodos = await todosTable.findAll({ orderBy: "_created_at", order: "DESC" });
      setTodos(allTodos);
    };

    loadTodos();

    // Ouve eventos para manter a UI reativa
    todosTable.on("changed", loadTodos);

    return () => {
      todosTable.off("changed", loadTodos);
    };
  }, [engine, isInitialized]);

  // Funções CRUD
  const createTodo = async (text: string) => {
    if (!engine) return;
    await engine.table("todos").create({ text, completed: false, priority: 'medium', tags: [] });
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    if (!engine) return;
    await engine.table("todos").update(id, { completed });
  };

  const deleteTodo = async (id: string) => {
    if (!engine) return;
    await engine.table("todos").delete(id);
  };

  return { todos, createTodo, toggleTodo, deleteTodo };
};
```

## Passo 3: Construir a Interface do Usuário

Finalmente, vamos usar nossos hooks para construir a UI do aplicativo.

```tsx title="components/TodoList.tsx"
import React, { useState } from "react";
import { View, Text, TextInput, Button, FlatList, Switch, StyleSheet } from "react-native";
import { useOfflineEngine, useTodos } from "../lib/hooks";

export default function TodoList() {
  const { engine, isInitialized } = useOfflineEngine();
  const { todos, createTodo, toggleTodo, deleteTodo } = useTodos(engine, isInitialized);
  const [text, setText] = useState("");

  if (!isInitialized) {
    return <Text>Inicializando a engine...</Text>;
  }

  const getStatusColor = (status: string) => {
    if (status === 'synced') return 'green';
    if (status === 'pending' || status === 'syncing') return 'orange';
    if (status === 'failed') return 'red';
    return 'gray';
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Nova tarefa..."
        />
        <Button title="Adicionar" onPress={() => { createTodo(text); setText(""); }} />
      </View>

      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.todoItem}>
            <Switch
              value={item.completed}
              onValueChange={() => toggleTodo(item.id, !item.completed)}
            />
            <Text style={[styles.todoText, item.completed && styles.completedText]}>
              {item.text}
            </Text>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item._status) }]} />
            <Button title="X" color="red" onPress={() => deleteTodo(item.id)} />
          </View>
        )}
      />
    </View>
  );
}

// (Adicione os estilos abaixo)
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  inputContainer: { flexDirection: 'row', marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 8, marginRight: 8 },
  todoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  todoText: { flex: 1, fontSize: 16, marginLeft: 8 },
  completedText: { textDecorationLine: 'line-through', color: '#aaa' },
  statusIndicator: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
});
```

## Conclusão

É isso! Com esses três arquivos, você tem um aplicativo de tarefas offline-first.

- **Funciona Offline:** Adicione, edite e delete tarefas sem internet.
- **UI Reativa:** A lista se atualiza instantaneamente.
- **Sincronização Automática:** As mudanças são enviadas ao servidor em segundo plano.
- **Status Visual:** O indicador de status mostra se um item está pendente, sincronizado ou com falha.

A partir daqui, você pode explorar guias mais aprofundados para entender cada parte da biblioteca.
