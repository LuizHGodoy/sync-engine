import bodyParser from "body-parser";
import cors from "cors";
import express from "express";

const app = express();
const port = 4000;

app.use(cors());
app.use(bodyParser.json());

let todos = [];

function mergeTodo(local, remote) {
  if (local.deleted || remote.deleted) {
    return { ...local, ...remote, deleted: true };
  }
  return local.updatedAt > remote.updatedAt ? local : remote;
}

app.post("/sync", (req, res) => {
  const { data, lastSync } = req.body;
  const serverTimestamp = Date.now();

  if (Array.isArray(data)) {
    data.forEach((item) => {
      const idx = todos.findIndex((t) => t.id === item.id);
      if (idx >= 0) {
        todos[idx] = mergeTodo(todos[idx], item);
      } else {
        todos.push(item);
      }
    });
  }

  const changes = lastSync
    ? todos.filter((t) => t.updatedAt > lastSync)
    : todos;

  res.json({
    success: true,
    data: changes,
    conflicts: [],
    serverTimestamp,
  });
});

app.get("/todos", (req, res) => {
  res.json(todos.filter((t) => !t.deleted));
});

app.listen(port, () => {
  console.log(`Demo server rodando em http://localhost:${port}`);
});
