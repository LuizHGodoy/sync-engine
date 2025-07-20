---
id: utilitarios
title: Utilitários e Constantes
---

## Utilitários e Constantes

A `sync-engine-lib` exporta vários objetos de utilidade e constantes para ajudar a simplificar a configuração e o desenvolvimento.

## `SyncEngineUtils`

Um objeto com funções úteis para trabalhar com a engine.

### `generateId()`

Gera um ID local único para novos registros. A `OfflineFirstEngine` já usa isso internamente ao chamar `.create()`, mas pode ser útil se você precisar de um ID antes de criar o item.

```typescript
import { SyncEngineUtils } from "sync-engine-lib";

const novoId = SyncEngineUtils.generateId();
// Exemplo: "local_1678886400000_abcdef"
```

### `createDefaultConfig(serverUrl)`

Cria um objeto de configuração `SyncConfig` com valores padrão balanceados.

```typescript
const config = SyncEngineUtils.createDefaultConfig("https://api.meusite.com");
```

### `createOptimizedConfig(serverUrl, preset)`

Cria um objeto de configuração `SyncConfig` com base em presets de performance.

- **Presets:** `'conservative'`, `'balanced'`, `'aggressive'`, `'realtime'`.

```typescript
const aggressiveConfig = SyncEngineUtils.createOptimizedConfig(
  "https://api.meusite.com",
  "aggressive"
);
```

### `validateConfig(config)`

Valida um objeto de configuração e retorna um objeto com um booleano `valid` e um array de `errors`.

```typescript
const { valid, errors } = SyncEngineUtils.validateConfig(minhaConfig);
if (!valid) {
  console.error("Configuração inválida:", errors);
}
```

---

## `SyncEngineConstants`

Um objeto que expõe constantes numéricas para valores comuns de configuração, ajudando a manter a consistência.

```typescript
import { SyncEngineConstants } from "sync-engine-lib";

const config = {
  // ...
  syncInterval: SyncEngineConstants.SYNC_INTERVALS.VERY_SLOW, // 300000 (5 minutos)
  batchSize: SyncEngineConstants.BATCH_SIZES.LARGE, // 25
  requestTimeout: SyncEngineConstants.TIMEOUTS.SLOW, // 30000
  initialRetryDelay: SyncEngineConstants.RETRY_DELAYS.NORMAL, // 1000
};
```

### Constantes Disponíveis

- **`SYNC_INTERVALS`**:
  - `VERY_FAST` (5s)
  - `FAST` (15s)
  - `NORMAL` (30s)
  - `SLOW` (1min)
  - `VERY_SLOW` (5min)
- **`BATCH_SIZES`**:
  - `SMALL` (5)
  - `MEDIUM` (10)
  - `LARGE` (25)
  - `VERY_LARGE` (50)
- **`TIMEOUTS`**:
  - `FAST` (5s)
  - `NORMAL` (10s)
  - `SLOW` (30s)
- **`RETRY_DELAYS`**:
  - `FAST` (0.5s)
  - `NORMAL` (1s)
  - `SLOW` (2s)
