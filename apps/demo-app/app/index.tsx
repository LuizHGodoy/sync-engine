import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { SyncEngineFactory, SyncEngineUtils } from "sync-engine-lib";

const SERVER_URL = "http://192.168.3.3:4000";

const DARK = {
  background: "#181A20",
  card: "#23262F",
  border: "#353945",
  text: "#F4F4F4",
  subtext: "#A3A3A3",
  accent: "#4F8EF7",
  danger: "#E74C3C",
  pending: "#E67E22",
  input: "#23262F",
  logBg: "#23262F",
  logText: "#A3A3A3",
};

export default function Index() {
  const [syncEngine] = useState(() =>
    SyncEngineFactory.createForDevelopment(SERVER_URL)
  );
  const [todos, setTodos] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const update = async () => {
      if (isMounted) {
        setTodos(
          (await syncEngine.getLocalQueueItems()).filter(
            (t) => !t.payload.deleted
          )
        );
        setStatus(await syncEngine.getStatus());
      }
    };
    syncEngine.addEventListener(async (event) => {
      setLog((prev) => [
        `[${new Date(event.timestamp).toLocaleTimeString()}] ${event.type}`,
        ...prev.slice(0, 19),
      ]);
      await update();
    });
    (async () => {
      await syncEngine.initialize();
      await syncEngine.start();
      await update();
    })();
    return () => {
      isMounted = false;
      syncEngine.destroy();
    };
  }, []);

  useEffect(() => {
    syncEngine.setForcedOnline(isOnline);
  }, [isOnline]);

  const addTodo = async () => {
    if (!input.trim()) return;
    await syncEngine.addToQueue(SyncEngineUtils.generateId(), "todo", {
      text: input,
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setInput("");
  };

  const startEdit = (item: any) => {
    setEditId(item.id);
    setEditText(item.payload.text);
  };

  const saveEdit = async (item: any) => {
    if (!editText.trim()) return;
    await syncEngine.addToQueue(item.id, "todo", {
      ...item.payload,
      text: editText,
      updatedAt: Date.now(),
    });
    setEditId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditText("");
  };

  const toggleTodo = async (item: any) => {
    await syncEngine.addToQueue(item.id, "todo", {
      ...item.payload,
      done: !item.payload.done,
      updatedAt: Date.now(),
    });
  };

  const deleteTodo = async (item: any) => {
    Alert.alert(
      "Deletar tarefa",
      "Tem certeza que deseja deletar esta tarefa?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: async () => {
            await syncEngine.addToQueue(item.id, "todo", {
              ...item.payload,
              deleted: true,
              updatedAt: Date.now(),
            });
          },
        },
      ]
    );
  };

  const fetchServerTodos = async () => {
    if (!isOnline) {
      alert("Você está offline!");
      return;
    }
    try {
      const res = await fetch(`${SERVER_URL}/todos`);
      const data = await res.json();
      alert("Todos do servidor:\n" + JSON.stringify(data, null, 2));
    } catch (e: any) {
      alert("Erro ao buscar do servidor: " + e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Todo List Offline-First</Text>
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            Status:{" "}
            <Text style={{ color: isOnline ? DARK.accent : DARK.danger }}>
              {status ? (status.isOnline ? "Online" : "Offline") : "..."}
            </Text>
          </Text>
          <Text style={styles.statusText}>
            Itens pendentes:{" "}
            <Text style={{ color: DARK.pending }}>
              {status?.pendingItems ?? "..."}
            </Text>
          </Text>
          <Text style={styles.statusText}>
            Última sync:{" "}
            <Text style={{ color: DARK.subtext }}>
              {status?.lastSync
                ? new Date(status.lastSync).toLocaleTimeString()
                : "Nunca"}
            </Text>
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            { backgroundColor: isOnline ? DARK.danger : DARK.accent },
          ]}
          onPress={() => setIsOnline((v) => !v)}
          activeOpacity={0.85}
        >
          <Text style={styles.toggleBtnText}>
            {isOnline ? "SIMULAR OFFLINE" : "SIMULAR ONLINE"}
          </Text>
        </TouchableOpacity>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Nova tarefa..."
            placeholderTextColor={DARK.subtext}
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity
            style={styles.addBtn}
            onPress={addTodo}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>ADICIONAR</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.serverBtn}
          onPress={fetchServerTodos}
          activeOpacity={0.85}
        >
          <Text style={styles.serverBtnText}>BUSCAR DO SERVIDOR</Text>
        </TouchableOpacity>
        <FlatList
          data={todos.filter((t) => t.type === "todo")}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.todoCard,
                item.status === "pending" && { borderColor: DARK.pending },
              ]}
            >
              <TouchableOpacity
                onPress={() => toggleTodo(item)}
                style={{ flex: 1 }}
              >
                {editId === item.id ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          flex: 1,
                          marginRight: 4,
                          backgroundColor: DARK.background,
                          borderColor: DARK.accent,
                        },
                      ]}
                      value={editText}
                      onChangeText={setEditText}
                      autoFocus
                    />
                    <TouchableOpacity
                      onPress={() => saveEdit(item)}
                      style={[
                        styles.addBtn,
                        { marginRight: 4, backgroundColor: DARK.accent },
                      ]}
                    >
                      <Text style={styles.addBtnText}>Salvar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={cancelEdit}
                      style={[styles.addBtn, { backgroundColor: DARK.danger }]}
                    >
                      <Text style={styles.addBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text
                    style={{
                      fontSize: 18,
                      textDecorationLine: item.payload.done
                        ? "line-through"
                        : "none",
                      color:
                        item.status === "pending" ? DARK.pending : DARK.text,
                    }}
                  >
                    {item.payload.text}
                  </Text>
                )}
              </TouchableOpacity>
              {editId !== item.id && (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => startEdit(item)}
                    style={{ marginRight: 8 }}
                  >
                    <Text style={{ color: DARK.accent, fontWeight: "bold" }}>
                      Editar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteTodo(item)}>
                    <Text style={{ color: DARK.danger, fontWeight: "bold" }}>
                      Deletar
                    </Text>
                  </TouchableOpacity>
                  {item.status === "pending" && (
                    <Text style={styles.badge}>pendente</Text>
                  )}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text
              style={{
                color: DARK.subtext,
                textAlign: "center",
                marginTop: 32,
              }}
            >
              Nenhuma tarefa
            </Text>
          }
          style={{ marginTop: 12 }}
        />
        <View style={styles.logBox}>
          <Text style={styles.logTitle}>Log de eventos:</Text>
          <FlatList
            data={log}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => (
              <Text style={styles.logText}>{item}</Text>
            )}
            style={{ maxHeight: 120 }}
          />
        </View>
        <StatusBar hidden />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DARK.background,
  },
  container: {
    flex: 1,
    backgroundColor: DARK.background,
    padding: 20,
    paddingTop: Platform.OS === "android" ? 40 : 60,
  },
  title: {
    color: DARK.text,
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 18,
    letterSpacing: 0.5,
  },
  statusBox: {
    backgroundColor: DARK.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    color: DARK.text,
    fontSize: 14,
    marginBottom: 2,
  },
  toggleBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleBtnText: {
    color: DARK.text,
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  input: {
    flex: 1,
    backgroundColor: DARK.input,
    color: DARK.text,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DARK.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 8,
  },
  addBtn: {
    backgroundColor: DARK.accent,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  addBtnText: {
    color: DARK.text,
    fontWeight: "bold",
    fontSize: 14,
    letterSpacing: 1,
  },
  serverBtn: {
    backgroundColor: DARK.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  serverBtnText: {
    color: DARK.text,
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 1,
  },
  todoCard: {
    backgroundColor: DARK.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: DARK.border,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    backgroundColor: DARK.pending,
    color: DARK.card,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 10,
    overflow: "hidden",
  },
  logBox: {
    backgroundColor: DARK.logBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 18,
    marginBottom: 8,
  },
  logTitle: {
    color: DARK.text,
    fontWeight: "bold",
    fontSize: 13,
    marginBottom: 4,
  },
  logText: {
    color: DARK.logText,
    fontSize: 12,
    fontFamily: Platform.OS === "android" ? "monospace" : "Menlo",
  },
});
