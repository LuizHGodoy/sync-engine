# Sync Engine Monorepo

This repository contains a complete solution for offline-first bidirectional synchronization in React Native/Expo, including:

- **`packages/sync-engine-lib`**: TypeScript library for offline/online synchronization with SQLite and autosync.
- **`apps/demo-app`**: Expo app demonstrating library usage with an offline-first Todo List.
- **`apps/demo-server`**: Express server for simulating backend and testing sync flow.

---

## 🚀 Overview

- Bidirectional synchronization: app <-> server
- 100% offline functionality: all operations are saved locally and synchronized when connection returns
- Conflict resolution, automatic retry, persistent queue (SQLite)
- Ready for React Native/Expo SDK 53+

---

## 📦 Sync Engine Lib

TypeScript library for offline-first bidirectional synchronization.

### Installation

```bash
yarn add sync-engine-lib
# or
npm install sync-engine-lib
```

**Peer dependencies:**

```bash
yarn add expo-sqlite @react-native-community/netinfo
```

### Basic Usage

```typescript
import { SyncEngineFactory } from "sync-engine-lib";

const syncEngine = SyncEngineFactory.createForDevelopment(
  "http://localhost:4000"
);
await syncEngine.initialize();
await syncEngine.start();

// Adds item to queue (offline or online)
await syncEngine.addToQueue(SyncEngineUtils.generateId(), "todo", {
  text: "My task",
  done: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
```

### Offline-First Flow

- **Online:** The app automatically synchronizes with the server.
- **Offline:** All operations are saved locally (SQLite). No requests are made to the server.
- **When back online:** SyncEngine sends everything that was pending to the server.

You can force offline/online mode for testing:

```typescript
syncEngine.setForcedOnline(false); // Force offline mode
syncEngine.setForcedOnline(true); // Force online mode
syncEngine.setForcedOnline(null); // Return to automatic mode
```

---

## 📱 Demo App (Expo)

Todo List app demonstrating Sync Engine usage.

![Offline-first app demo](apps/demo-app/assets/images/tela-demo.png)

### Running the app

```bash
cd apps/demo-app
yarn install
npx expo start
```

- The app works 100% offline-first.
- Use the "Simulate Offline" button to test offline flow.
- Create, edit and delete tasks even without internet. When back online, everything will be synchronized.

---

## 🖥️ Demo Server

Simple Express server for simulating backend and testing synchronization.

### Running the server

```bash
cd apps/demo-server
yarn install
yarn start
```

- The server exposes `/sync` (POST) and `/todos` (GET)
- Supports soft delete, simple merge and task updates

---

## 🔄 Complete Flow Example

1. Start the server: `cd apps/demo-server && yarn start`
2. Start the app: `cd apps/demo-app && npx expo start`
3. In the app, add/edit/delete tasks offline
4. Go back online: SyncEngine synchronizes everything automatically
5. See the event log in the app and updated data on the server

---

## 🛠️ Useful Commands

- **Build the lib:**

  ```bash
  cd packages/sync-engine-lib
  yarn build
  ```

- **Clear Expo cache:**

  ```bash
  npx expo start -c
  ```

- **Reinstall dependencies:**

  ```bash
  yarn install
  ```

---

## 🤝 Contributing

1. Fork the project
2. Create a branch: `git checkout -b feature/new-feature`
3. Commit: `git commit -m 'feat: new feature'`
4. Push: `git push origin feature/new-feature`
5. Open a Pull Request

---

## 📄 License

MIT

---

Developed for React Native/Expo SDK 53+ with TypeScript, SQLite and NetInfo.
