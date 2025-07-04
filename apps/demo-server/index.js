import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

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
  const { data } = req.body;
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
  res.json({
    success: true,
    data: todos,
    conflicts: [],
  });
});

app.get("/todos", (req, res) => {
  res.json(todos.filter((t) => !t.deleted));
});

app.listen(port, () => {
  console.log(`Demo server rodando em http://localhost:${port}`);
});
