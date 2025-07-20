---
id: sincronizacao-em-background
title: Sincronização em Background
---

## Sincronização em Background

Uma das features mais poderosas da `sync-engine-lib` é a capacidade de sincronizar dados mesmo quando o aplicativo não está em primeiro plano. Isso garante que os dados do usuário sejam enviados ao servidor assim que possível, melhorando a resiliência e a confiabilidade do aplicativo.

A biblioteca gerencia a complexidade de registrar e executar tarefas em segundo plano em diferentes plataformas (iOS/Android) e ambientes (Expo/React Native puro).

## Como Funciona

A sincronização em background é adicionada como uma camada sobre uma instância existente da `SyncEngine` ou `OfflineFirstEngine`. A biblioteca tenta, em ordem:

1. **`expo-background-fetch`**: Se o seu projeto usa Expo, esta é a API preferida e mais robusta.
2. **`react-native-background-job`**: Para projetos React Native puros, ela busca por esta biblioteca.
3. **Timer Fallback**: Se nenhuma das opções acima estiver disponível, ela usa um `setInterval` como um fallback simples, que só funcionará enquanto o app estiver ativo (em primeiro ou segundo plano, mas não fechado).

## Habilitando a Sincronização em Background

O `demo-app` não usa a função `addBackgroundSyncToEngine`, mas a biblioteca a exporta para uso. A maneira mais fácil de habilitar o background sync é usando a função `addBackgroundSyncToEngine`.

```typescript
import { OfflineFirstEngine, addBackgroundSyncToEngine } from "sync-engine-lib";

// 1. Crie sua instância da engine normalmente
const engine = new OfflineFirstEngine({
  adapter: /* ... */,
  entities: { /* ... */ },
});

// 2. "Melhore" sua instância com as capacidades de background sync
const engineComBackground = addBackgroundSyncToEngine(engine);

// 3. Inicialize a engine
await engineComBackground.initialize();
await engineComBackground.start();

// 4. Habilite a tarefa de background
await engineComBackground.enableBackgroundSync({
  taskName: 'minha-tarefa-de-sync', // Nome único para a tarefa
  interval: 15 * 60 * 1000, // Intervalo em milissegundos (ex: 15 minutos)
});
```

### O que `addBackgroundSyncToEngine` faz?

Esta função "decora" sua instância da engine, adicionando três novos métodos:

- `engine.enableBackgroundSync(options)`: Registra e agenda a tarefa de background.
- `engine.disableBackgroundSync()`: Cancela e desregistra a tarefa.
- `engine.isBackgroundSyncEnabled()`: Retorna `true` se a tarefa de background estiver ativa.

## Configuração Adicional (Expo)

Se você está usando Expo, precisa adicionar a configuração do `expo-background-fetch` ao seu `app.json`.

```json title="app.json"
{
  "expo": {
    // ...
    "plugins": [
      // ...
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "13.4"
          }
        }
      ]
    ],
    "ios": {
      // ...
      "infoPlist": {
        "UIBackgroundModes": ["fetch", "processing"]
      }
    }
  }
}
```

E instalar o plugin:

```bash
npx expo install expo-build-properties
```

## Opções de Configuração

Ao chamar `enableBackgroundSync(options)`, você pode passar um objeto de configuração:

- `taskName` (string): Um nome único para sua tarefa de background. É importante que seja único no seu app.
- `interval` (number): O intervalo mínimo, em milissegundos, entre as execuções da tarefa. Note que o sistema operacional (Android/iOS) pode não respeitar este valor exatamente para economizar bateria.
- `enableOnAppBackground` (boolean): Se `true`, tenta disparar uma sincronização quando o app vai para segundo plano.
- `enableOnNetworkReconnect` (boolean): Se `true`, tenta disparar uma sincronização quando a rede volta a ficar online.
- `maxBackgroundDuration` (number): Tempo máximo (em ms) que a tarefa pode rodar antes de ser considerada um timeout.

## Verificando o Status

Você pode verificar qual gerenciador de tarefas está sendo usado e o status da tarefa:

```typescript
if (engine.isBackgroundSyncEnabled()) {
  const status = await engine.backgroundSync.getBackgroundSyncStatus();
  console.log(`Background sync está ativo usando: ${"$"}{status.taskManager}`);
  console.log(`ID da Tarefa: ${"$"}{status.taskId}`);
}
```
