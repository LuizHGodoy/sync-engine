import { useEffect, useRef, useState } from "react";
import { OfflineFirstEngine } from "sync-engine-lib";
import { createOfflineEngine } from "./offlineEngine";

export interface SyncStats {
  queue: {
    pending: number;
    syncing: number;
    failed: number;
    synced: number;
  };
  worker: {
    processed: number;
    succeeded: number;
    failed: number;
    lastRun?: number;
    isRunning: boolean;
  };
  isOnline: boolean;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  dueDate?: Date;
  tags: string[];
  _status: "new" | "pending" | "syncing" | "synced" | "conflict" | "failed";
  _server_id?: string;
  _version: number;
  _created_at: number;
  _updated_at: number;
  _deleted_at?: number;
}

export type TodoCreateData = Omit<
  TodoItem,
  | "id"
  | "_status"
  | "_server_id"
  | "_version"
  | "_created_at"
  | "_updated_at"
  | "_deleted_at"
>;

export const useOfflineEngine = () => {
  const engineRef = useRef<OfflineFirstEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const initializingRef = useRef(false);

  useEffect(() => {
    const initEngine = async () => {
      if (initializingRef.current || engineRef.current) {
        return;
      }

      initializingRef.current = true;

      try {
        const engine = createOfflineEngine();
        engineRef.current = engine;

        engine.worker.addEventListener((event) => {
          const timestamp = new Date(event.timestamp).toLocaleTimeString();
          const logMessage = `[${timestamp}] ${event.type}: ${JSON.stringify(
            event.data
          )}`;

          setLogs((prev) => [logMessage, ...prev.slice(0, 19)]);
          updateStats();
        });

        await engine.initialize();
        await engine.start();

        setIsInitialized(true);
        await updateStats();
      } catch (error) {
        console.error("Failed to initialize offline engine:", error);
        setIsInitialized(false);
      } finally {
        initializingRef.current = false;
      }
    };

    const updateStats = async () => {
      if (engineRef.current) {
        try {
          const stats = await engineRef.current.getStats();
          setStats(stats);
        } catch (error) {
          console.error("Failed to get stats:", error);
        }
      }
    };

    initEngine();

    const statsInterval = setInterval(updateStats, 5000);

    return () => {
      clearInterval(statsInterval);
      if (engineRef.current) {
        engineRef.current.close();
        engineRef.current = null;
      }
      setIsInitialized(false);
      initializingRef.current = false;
    };
  }, []);

  return {
    engine: engineRef.current,
    isInitialized,
    stats,
    logs,
  };
};

export const useTodos = (
  engine: OfflineFirstEngine | null,
  isInitialized: boolean
) => {
  const [todos, setTodos] = useState<TodoItem[]>([]);

  useEffect(() => {
    if (!engine || !isInitialized) return;

    const loadTodos = async () => {
      try {
        const todosTable = engine.table("todos");
        const allTodos = await todosTable.findAll({
          orderBy: "_created_at",
          order: "DESC",
        });
        setTodos(allTodos as TodoItem[]);
      } catch (error) {
        console.error("Failed to load todos:", error);
      }
    };

    loadTodos();

    const todosTable = engine.table("todos");
    const handleChange = () => loadTodos();

    todosTable.on("created", handleChange);
    todosTable.on("updated", handleChange);
    todosTable.on("deleted", handleChange);

    return () => {
      todosTable.off("created", handleChange);
      todosTable.off("updated", handleChange);
      todosTable.off("deleted", handleChange);
    };
  }, [engine, isInitialized]);

  const createTodo = async (data: {
    text: string;
    priority?: "low" | "medium" | "high";
    dueDate?: Date;
    tags?: string[];
  }) => {
    if (!engine || !isInitialized) return;

    const todosTable = engine.table("todos");
    const todoData = {
      text: data.text,
      completed: false,
      priority: data.priority || "medium",
      dueDate: data.dueDate,
      tags: data.tags || [],
    };
    return todosTable.create(todoData);
  };

  const updateTodo = async (
    id: string,
    updates: Partial<
      Pick<TodoItem, "text" | "completed" | "priority" | "dueDate" | "tags">
    >
  ) => {
    if (!engine || !isInitialized) return;

    const todosTable = engine.table("todos");
    return todosTable.update(id, updates);
  };

  const deleteTodo = async (id: string) => {
    if (!engine || !isInitialized) return;

    const todosTable = engine.table("todos");
    return todosTable.delete(id);
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    return updateTodo(id, { completed });
  };

  return {
    todos,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
  };
};
