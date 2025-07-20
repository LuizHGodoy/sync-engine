---
id: monitoramento-de-rede
title: Monitoramento de Rede
---

## Monitoramento de Rede

Saber se o dispositivo está online ou offline é fundamental para uma estratégia de sincronização eficiente. A `sync-engine-lib` inclui uma classe `NetMonitor` dedicada a essa tarefa, utilizando `@react-native-community/netinfo` por baixo dos panos.

A `OfflineFirstEngine` já cria e gerencia uma instância do `NetMonitor` para você. O `BackgroundSyncWorker` a utiliza para decidir quando deve ou não tentar processar a fila de sincronização.

## Acessando o `NetMonitor`

Você pode acessar a instância do `NetMonitor` através da sua engine para obter informações sobre o estado da conexão:

```typescript
const engine = new OfflineFirstEngine(/* ... */);
await engine.initialize();

const netMonitor = engine.network;

// Verifica o status da conexão de forma síncrona (usa o último estado conhecido)
const isOnline = netMonitor.getConnectionStatus();
console.log(isOnline ? "Estou online!" : "Estou offline.");

// Força uma nova verificação assíncrona
const isReallyOnline = await netMonitor.checkConnection();
console.log("Status da conexão verificado:", isReallyOnline);
```

## Ouvindo Mudanças de Conectividade

O `NetMonitor` permite que você registre "listeners" para ser notificado sempre que o status da conexão mudar. A `OfflineFirstEngine` já faz isso internamente para iniciar a sincronização assim que a rede fica disponível.

Você também pode usar isso para, por exemplo, exibir um banner de "Você está offline" na sua UI.

A `OfflineFirstEngine` expõe esses eventos através do seu próprio sistema de eventos.

```typescript
engine.worker.addEventListener((event) => {
  if (event.type === "sync_started" && event.data?.isOnline) {
    console.log("A conexão voltou! Iniciando sincronização...");
    // Atualize o estado da sua UI aqui
  }
});
```

## Forçando um Estado de Conexão (Para Testes)

Durante o desenvolvimento e testes, pode ser muito útil simular condições de rede offline sem ter que desligar o Wi-Fi do seu dispositivo ou emulador. O `NetMonitor` oferece um método para isso.

```typescript
const netMonitor = engine.network;

// Força o estado para OFFLINE, não importa qual seja a conexão real
netMonitor.setForcedOnline(false);
// Agora, netMonitor.getConnectionStatus() retornará false

// A engine não tentará sincronizar enquanto o estado estiver forçado para offline
await engine.forceSync(); // Lançará um erro "No network connection"

// Para voltar ao comportamento normal, passe null
netMonitor.setForcedOnline(null);
// Agora, netMonitor.getConnectionStatus() voltará a refletir o estado real da rede.
```

Esta funcionalidade é extremamente útil para testar a resiliência do seu aplicativo e garantir que a UI se comporte como esperado em cenários offline.
