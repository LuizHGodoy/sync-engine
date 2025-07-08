import React, { useState } from "react";
import {
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SyncStats, TodoItem, useOfflineEngine, useTodos } from "../lib/hooks";

const COLORS = {
  background: "#1a1a1a",
  surface: "#2d2d2d",
  primary: "#4CAF50",
  secondary: "#2196F3",
  danger: "#f44336",
  warning: "#ff9800",
  text: "#ffffff",
  textSecondary: "#b0b0b0",
  border: "#404040",
  pending: "#ff9800",
  synced: "#4CAF50",
  failed: "#f44336",
};

export default function OfflineFirstDemo() {
  const { engine, isInitialized, stats, logs } = useOfflineEngine();
  const { todos, createTodo, updateTodo, deleteTodo, toggleTodo } = useTodos(
    engine,
    isInitialized
  );

  const [newTodoText, setNewTodoText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<
    "low" | "medium" | "high"
  >("medium");

  const handleAddTodo = async () => {
    if (!newTodoText.trim() || !engine || !isInitialized) return;

    try {
      await createTodo({
        text: newTodoText.trim(),
        priority: selectedPriority,
        tags: ["demo"],
      });
      setNewTodoText("");
    } catch (error) {
      console.error("Failed to create todo:", error);
      Alert.alert("Erro", "Falha ao criar todo");
    }
  };

  const handleEditTodo = (todo: TodoItem) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || !editingId || !engine || !isInitialized) return;

    try {
      await updateTodo(editingId, { text: editText.trim() });
      setEditingId(null);
      setEditText("");
    } catch (error) {
      console.error("Failed to update todo:", error);
      Alert.alert("Erro", "Falha ao atualizar todo");
    }
  };

  const handleDeleteTodo = async (id: string) => {
    if (!engine || !isInitialized) return;

    Alert.alert("Confirmar", "Deseja deletar este todo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Deletar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTodo(id);
          } catch (error) {
            console.error("Failed to delete todo:", error);
            Alert.alert("Erro", "Falha ao deletar todo");
          }
        },
      },
    ]);
  };

  const handleToggleTodo = async (id: string, completed: boolean) => {
    if (!engine || !isInitialized) return;

    try {
      await toggleTodo(id, !completed);
    } catch (error) {
      console.error("Failed to toggle todo:", error);
      Alert.alert("Erro", "Falha ao atualizar todo");
    }
  };

  const handleForceSync = async () => {
    if (!engine || !isInitialized) return;

    try {
      await engine.forceSync();
      Alert.alert("Sucesso", "Sincronização forçada iniciada");
    } catch (error) {
      console.error("Failed to force sync:", error);
      Alert.alert("Erro", "Falha ao iniciar sincronização");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "synced":
        return COLORS.synced;
      case "pending":
      case "syncing":
        return COLORS.pending;
      case "failed":
      case "conflict":
        return COLORS.failed;
      default:
        return COLORS.textSecondary;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return COLORS.danger;
      case "medium":
        return COLORS.warning;
      case "low":
        return COLORS.secondary;
      default:
        return COLORS.textSecondary;
    }
  };

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar hidden />
        <View style={styles.centered}>
          <Text style={styles.loadingText}>
            Inicializando Offline Engine...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Offline-First Demo</Text>
        <TouchableOpacity
          style={[styles.button, styles.syncButton]}
          onPress={handleForceSync}
        >
          <Text style={styles.buttonText}>🔄 Sync</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Stats */}
        {stats && <StatsPanel stats={stats} />}

        {/* Add Todo */}
        <View style={styles.addSection}>
          <View style={styles.prioritySelector}>
            {(["low", "medium", "high"] as const).map((priority) => (
              <TouchableOpacity
                key={priority}
                style={[
                  styles.priorityButton,
                  selectedPriority === priority && {
                    backgroundColor: getPriorityColor(priority),
                  },
                ]}
                onPress={() => setSelectedPriority(priority)}
              >
                <Text
                  style={[
                    styles.priorityText,
                    selectedPriority === priority && { color: COLORS.text },
                  ]}
                >
                  {priority.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={newTodoText}
              onChangeText={setNewTodoText}
              placeholder="Adicionar novo todo..."
              placeholderTextColor={COLORS.textSecondary}
              onSubmitEditing={handleAddTodo}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddTodo}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Todos List */}
        <FlatList
          data={todos}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TodoItemComponent
              todo={item}
              isEditing={editingId === item.id}
              editText={editText}
              onEditTextChange={setEditText}
              onToggle={() => handleToggleTodo(item.id, item.completed)}
              onEdit={() => handleEditTodo(item)}
              onSave={handleSaveEdit}
              onCancel={() => {
                setEditingId(null);
                setEditText("");
              }}
              onDelete={() => handleDeleteTodo(item.id)}
              getStatusColor={getStatusColor}
              getPriorityColor={getPriorityColor}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhum todo encontrado</Text>
              <Text style={styles.emptySubtext}>
                Adicione um novo todo acima
              </Text>
            </View>
          }
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Logs Toggle */}
        <View style={styles.logsToggle}>
          <Text style={styles.logsToggleText}>Mostrar Logs</Text>
          <Switch
            value={showLogs}
            onValueChange={setShowLogs}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={showLogs ? COLORS.text : COLORS.textSecondary}
          />
        </View>

        {/* Logs */}
        {showLogs && <LogsPanel logs={logs} />}
      </View>
    </SafeAreaView>
  );
}

interface TodoItemProps {
  todo: TodoItem;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (text: string) => void;
  onToggle: () => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;
}

const TodoItemComponent: React.FC<TodoItemProps> = ({
  todo,
  isEditing,
  editText,
  onEditTextChange,
  onToggle,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  getStatusColor,
  getPriorityColor,
}) => {
  if (isEditing) {
    return (
      <View style={styles.todoItem}>
        <TextInput
          style={[styles.input, styles.editInput]}
          value={editText}
          onChangeText={onEditTextChange}
          onSubmitEditing={onSave}
          autoFocus
        />
        <View style={styles.editActions}>
          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Text style={styles.saveButtonText}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.todoItem}>
      <TouchableOpacity style={styles.checkbox} onPress={onToggle}>
        <Text style={styles.checkboxText}>{todo.completed ? "☑️" : "☐"}</Text>
      </TouchableOpacity>

      <View style={styles.todoContent}>
        <Text style={[styles.todoText, todo.completed && styles.completedText]}>
          {todo.text}
        </Text>

        <View style={styles.todoMeta}>
          <View
            style={[
              styles.priorityChip,
              { backgroundColor: getPriorityColor(todo.priority) },
            ]}
          >
            <Text style={styles.priorityChipText}>{todo.priority}</Text>
          </View>

          <View
            style={[
              styles.statusChip,
              { backgroundColor: getStatusColor(todo._status) },
            ]}
          >
            <Text style={styles.statusChipText}>{todo._status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.todoActions}>
        <TouchableOpacity style={styles.editActionButton} onPress={onEdit}>
          <Text style={styles.actionButtonText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteActionButton} onPress={onDelete}>
          <Text style={styles.actionButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const StatsPanel: React.FC<{ stats: SyncStats }> = ({ stats }) => (
  <View style={styles.statsPanel}>
    <Text style={styles.statsTitle}>Status da Sincronização</Text>

    <View style={styles.statsGrid}>
      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Online</Text>
        <Text
          style={[
            styles.statValue,
            { color: stats.isOnline ? COLORS.synced : COLORS.failed },
          ]}
        >
          {stats.isOnline ? "✓" : "✗"}
        </Text>
      </View>

      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Pendentes</Text>
        <Text style={[styles.statValue, { color: COLORS.pending }]}>
          {stats.queue.pending}
        </Text>
      </View>

      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Sincronizados</Text>
        <Text style={[styles.statValue, { color: COLORS.synced }]}>
          {stats.queue.synced}
        </Text>
      </View>

      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Falhas</Text>
        <Text style={[styles.statValue, { color: COLORS.failed }]}>
          {stats.queue.failed}
        </Text>
      </View>
    </View>

    <View style={styles.workerStats}>
      <Text style={styles.workerStatsText}>
        Worker: {stats.worker.processed} processados, {stats.worker.succeeded}{" "}
        sucessos, {stats.worker.failed} falhas
      </Text>
    </View>
  </View>
);

const LogsPanel: React.FC<{ logs: string[] }> = ({ logs }) => (
  <View style={styles.logsPanel}>
    <Text style={styles.logsTitle}>Logs de Sincronização</Text>
    <FlatList
      data={logs}
      keyExtractor={(_, index) => index.toString()}
      style={styles.logsList}
      renderItem={({ item }) => <Text style={styles.logItem}>{item}</Text>}
      ListEmptyComponent={
        <Text style={styles.emptyLogs}>Nenhum log disponível</Text>
      }
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  mainContent: {
    flex: 1,
  },
  footer: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButton: {
    backgroundColor: COLORS.secondary,
  },
  buttonText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  statsPanel: {
    margin: 12,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  statsTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  workerStats: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  workerStatsText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    textAlign: "center",
  },
  addSection: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  prioritySelector: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },
  priorityButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    fontSize: 14,
  },
  editInput: {
    marginRight: 0,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  todoItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxText: {
    fontSize: 18,
  },
  todoContent: {
    flex: 1,
  },
  todoText: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 4,
  },
  completedText: {
    textDecorationLine: "line-through",
    color: COLORS.textSecondary,
  },
  todoMeta: {
    flexDirection: "row",
  },
  priorityChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
  },
  priorityChipText: {
    fontSize: 8,
    fontWeight: "600",
    color: COLORS.text,
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 8,
    fontWeight: "600",
    color: COLORS.text,
  },
  todoActions: {
    flexDirection: "row",
  },
  editActionButton: {
    padding: 6,
    marginLeft: 4,
  },
  deleteActionButton: {
    padding: 6,
    marginLeft: 4,
  },
  actionButtonText: {
    fontSize: 14,
  },
  editActions: {
    flexDirection: "row",
  },
  saveButton: {
    backgroundColor: COLORS.synced,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  saveButtonText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 12,
  },
  cancelButton: {
    backgroundColor: COLORS.failed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  logsToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  logsToggleText: {
    color: COLORS.text,
    fontSize: 14,
  },
  logsPanel: {
    maxHeight: 150,
    backgroundColor: COLORS.surface,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
  },
  logsTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logsList: {
    maxHeight: 120,
  },
  logItem: {
    color: COLORS.textSecondary,
    fontSize: 10,
    padding: 6,
    fontFamily: "monospace",
  },
  emptyLogs: {
    color: COLORS.textSecondary,
    fontSize: 10,
    textAlign: "center",
    padding: 12,
  },
});
