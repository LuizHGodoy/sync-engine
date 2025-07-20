# Problemas Comuns e Soluções

Este guia aborda os problemas mais frequentes encontrados ao usar o Sync Engine e suas respectivas soluções. Cada problema inclui diagnóstico, causas possíveis e passos para resolução.

## 🚫 Items Não Estão Sincronizando

### Sintomas
- Items permanecem na queue com status "pending"
- Status do Sync Engine mostra `pendingItems > 0` mas `lastSync` não atualiza
- Não há atividade de rede visível

### Diagnóstico Rápido

```typescript
// Verificar status atual
const status = await syncEngine.getStatus();
console.log('Status:', status);

// Verificar items na queue
const queuedItems = await syncEngine.getQueuedItems();
console.log('Queue items:', queuedItems.length);

// Verificar conectividade
const networkInfo = await syncEngine.network.getConnectionDetails();
console.log('Network:', networkInfo);
```

### Possíveis Causas e Soluções

#### 1. **Problema de Conectividade**

```typescript
// ✅ Verificar conectividade
const isOnline = await syncEngine.isOnline();
if (!isOnline) {
  // Forçar detecção de rede
  await syncEngine.network.refreshConnectionState();
  
  // Ou forçar modo online para teste
  syncEngine.setForcedOnline(true);
}
```

#### 2. **SyncEngine Não Foi Iniciado**

```typescript
// ✅ Garantir inicialização completa
await syncEngine.initialize();
await syncEngine.start(); // ⚠️ Importante!

// Verificar se está rodando
const status = await syncEngine.getStatus();
console.log('Is active:', status.isActive);
```

#### 3. **URL do Servidor Incorreta**

```typescript
// ✅ Verificar configuração
const config = syncEngine.getConfig();
console.log('Server URL:', config.serverUrl);

// Testar conectividade manual
try {
  const response = await fetch(`${config.serverUrl}/health`);
  console.log('Server reachable:', response.ok);
} catch (error) {
  console.error('Server unreachable:', error.message);
}
```

#### 4. **Interval de Sync Muito Alto**

```typescript
// ✅ Forçar sincronização imediata
try {
  const result = await syncEngine.forceSync();
  console.log('Force sync result:', result);
} catch (error) {
  console.error('Force sync error:', error.message);
}

// Configurar interval menor para debug
await syncEngine.updateConfig({
  syncInterval: 5000 // 5 segundos
});
```

#### 5. **Headers de Autenticação Ausentes**

```typescript
// ✅ Verificar configuração de auth
const config = syncEngine.getConfig();
console.log('Headers:', config.headers);

// Atualizar headers se necessário
await syncEngine.updateConfig({
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  }
});
```

## ⚠️ Conflitos Não Estão Sendo Resolvidos

### Sintomas
- Items ficam travados com status "conflict"
- Logs mostram conflitos detectados mas não resolvidos
- Dados inconsistentes entre cliente e servidor

### Diagnóstico

```typescript
// Verificar estratégia de resolução
const conflictResolver = syncEngine.conflictResolver;
console.log('Current strategy:', conflictResolver.getStrategy());

// Listar items com conflito
const conflictItems = await syncEngine.getQueuedItems()
  .filter(item => item.status === 'conflict');
console.log('Conflict items:', conflictItems);
```

### Soluções

#### 1. **Estratégia de Conflito Não Configurada**

```typescript
// ✅ Configurar estratégia explícita
import { ConflictStrategies } from 'sync-engine-lib';

syncEngine.conflictResolver.setStrategy(
  ConflictStrategies.timestampWins()
);

// Ou estratégia customizada
syncEngine.conflictResolver.setStrategy({
  resolve: async (localItem, serverItem) => {
    // Sua lógica de resolução
    return localItem; // Cliente ganha
  }
});
```

#### 2. **Campos de Timestamp Ausentes**

```typescript
// ✅ Garantir campos de timestamp
await syncEngine.addToQueue('item-id', 'todo', {
  text: 'Todo text',
  done: false,
  updatedAt: Date.now(), // ⚠️ Importante para resolução
  version: 1 // Ou usar versionamento
});
```

#### 3. **Resolver Conflitos Manualmente**

```typescript
// ✅ Resolução manual quando necessário
const conflictItems = await syncEngine.getConflictItems();

for (const item of conflictItems) {
  const resolution = await askUserToResolveConflict(
    item.localData, 
    item.serverData
  );
  
  await syncEngine.resolveConflict(item.id, resolution);
}
```

## 🐌 Performance Lenta

### Sintomas
- Sincronização demora muito para completar
- App fica lento durante sync
- Timeouts de rede frequentes

### Diagnóstico

```typescript
// Medir performance de sync
console.time('Sync Performance');
const result = await syncEngine.forceSync();
console.timeEnd('Sync Performance');
console.log('Synced items:', result.syncedItems);

// Verificar tamanho da queue
const queueSize = await syncEngine.getQueuedItems().length;
console.log('Queue size:', queueSize);

// Analisar tamanho dos payloads
const items = await syncEngine.getQueuedItems();
const payloadSizes = items.map(item => 
  JSON.stringify(item.payload).length
);
console.log('Average payload size:', 
  payloadSizes.reduce((a, b) => a + b, 0) / payloadSizes.length
);
```

### Soluções

#### 1. **Otimizar Batch Size**

```typescript
// ✅ Ajustar tamanho do batch
await syncEngine.updateConfig({
  batchSize: 20, // Reduzir se necessário
});

// Para volumes muito grandes
await syncEngine.updateConfig({
  batchSize: 50, // Aumentar com cuidado
  requestTimeout: 30000 // Aumentar timeout também
});
```

#### 2. **Reduzir Tamanho dos Payloads**

```typescript
// ❌ Payload muito grande
await syncEngine.addToQueue('item-1', 'todo', {
  text: 'Todo',
  largeData: new Array(10000).fill('x').join(''), // ~10KB
  images: [base64Image1, base64Image2] // Muito grande!
});

// ✅ Payload otimizado
await syncEngine.addToQueue('item-1', 'todo', {
  text: 'Todo',
  imageIds: ['img-1', 'img-2'], // Referências apenas
  priority: 'high'
});
```

#### 3. **Implementar Paginação no Servidor**

```typescript
// ✅ Configurar limits no servidor
await syncEngine.updateConfig({
  batchSize: 25,
  maxRetries: 2,
  requestTimeout: 15000
});

// Implementar chunking para dados grandes
const largeDataChunks = chunkArray(largeDataArray, 100);
for (const chunk of largeDataChunks) {
  await syncEngine.addBatchToQueue(chunk);
}
```

#### 4. **Otimizar Frequency de Sync**

```typescript
// ✅ Ajustar interval baseado no contexto
// Para apps com muita atividade
await syncEngine.updateConfig({
  syncInterval: 30000 // 30 segundos
});

// Para apps com pouca atividade
await syncEngine.updateConfig({
  syncInterval: 60000 // 1 minuto
});

// Sync adaptativo baseado em activity
syncEngine.addEventListener((event) => {
  if (event.type === 'item_queued') {
    // Acelerar sync quando há atividade
    syncEngine.updateConfig({ syncInterval: 10000 });
  }
});
```

## 🔄 Loops Infinitos de Sincronização

### Sintomas
- Mesmo item sendo sincronizado repetidamente
- Logs mostram sync contínuo sem progresso
- CPU alta e battery drain

### Diagnóstico

```typescript
// Monitorar eventos de sync
let syncCount = 0;
syncEngine.addEventListener((event) => {
  if (event.type === 'sync_started') {
    syncCount++;
    if (syncCount > 10) {
      console.warn('Possible sync loop detected!');
    }
  }
});

// Verificar items que ficam "stuck"
const stuckItems = await syncEngine.getQueuedItems()
  .filter(item => item.retries > 5);
console.log('Stuck items:', stuckItems);
```

### Soluções

#### 1. **ID Duplicados**

```typescript
// ❌ Problema comum - IDs duplicados
await syncEngine.addToQueue('todo-1', 'todo', { text: 'First' });
await syncEngine.addToQueue('todo-1', 'todo', { text: 'Second' }); // Sobrescreve!

// ✅ Usar IDs únicos
import { SyncEngineUtils } from 'sync-engine-lib';

const uniqueId = SyncEngineUtils.generateId();
await syncEngine.addToQueue(uniqueId, 'todo', { text: 'Unique todo' });
```

#### 2. **Resposta do Servidor Inconsistente**

```typescript
// ✅ Validar response do servidor
// O servidor deve retornar success: true
// e não reprocessar items já sincronizados
```

#### 3. **Clear Items Sincronizados**

```typescript
// ✅ Limpar queue periodicamente
setInterval(async () => {
  await syncEngine.clearSyncedItems();
}, 5 * 60 * 1000); // A cada 5 minutos

// Ou baseado em evento
syncEngine.addEventListener((event) => {
  if (event.type === 'sync_completed' && event.data.syncedItems > 0) {
    setTimeout(() => {
      syncEngine.clearSyncedItems();
    }, 1000);
  }
});
```

## 📱 Problemas Específicos do React Native

### 1. **Metro Bundler Issues**

```bash
# ✅ Limpar cache do Metro
npx react-native start --reset-cache

# ✅ Limpar cache completo
cd ios && rm -rf build && cd ..
cd android && ./gradlew clean && cd ..
rm -rf node_modules
npm install
```

### 2. **SQLite Não Funciona**

```typescript
// ✅ Verificar instalação do expo-sqlite
import * as SQLite from 'expo-sqlite';

try {
  const db = await SQLite.openDatabaseAsync('test.db');
  console.log('SQLite working');
} catch (error) {
  console.error('SQLite error:', error);
  // Reinstalar: expo install expo-sqlite
}
```

### 3. **NetInfo Não Detecta Mudanças**

```typescript
// ✅ Verificar configuração do NetInfo
import NetInfo from '@react-native-community/netinfo';

// Configurar para iOS
NetInfo.configure({
  reachabilityUrl: 'https://clients3.google.com/generate_204',
  reachabilityTest: async (response) => response.status === 204,
  reachabilityLongTimeout: 60 * 1000,
  reachabilityShortTimeout: 5 * 1000,
  reachabilityRequestTimeout: 15 * 1000,
});
```

### 4. **Background Sync Não Funciona**

```typescript
// ✅ Configurar background tasks (iOS)
import BackgroundTask from 'react-native-background-task';

BackgroundTask.define(() => {
  // Sync em background
  syncEngine.forceSync().finally(() => {
    BackgroundTask.finish();
  });
});

// ✅ Para Android - usar Expo TaskManager
import { TaskManager } from 'expo-task-manager';

TaskManager.defineTask('background-sync', async () => {
  try {
    await syncEngine.forceSync();
    return BackgroundFetch.Result.NewData;
  } catch (error) {
    return BackgroundFetch.Result.Failed;
  }
});
```

## 🛠️ Ferramentas de Diagnóstico

### Quick Health Check

```typescript
// Função para diagnóstico rápido
export const diagnoseSyncEngine = async (syncEngine: any) => {
  console.log('🔍 Sync Engine Diagnostics');
  console.log('========================');

  try {
    // 1. Status geral
    const status = await syncEngine.getStatus();
    console.log('📊 Status:', {
      isActive: status.isActive,
      isOnline: status.isOnline,
      isSyncing: status.isSyncing,
      pendingItems: status.pendingItems,
      errorItems: status.errorItems,
      lastSync: status.lastSync ? new Date(status.lastSync) : 'Never'
    });

    // 2. Configuração
    const config = syncEngine.getConfig();
    console.log('⚙️ Config:', {
      serverUrl: config.serverUrl,
      batchSize: config.batchSize,
      syncInterval: config.syncInterval,
      maxRetries: config.maxRetries
    });

    // 3. Conectividade
    const networkDetails = await syncEngine.network.getConnectionDetails();
    console.log('📡 Network:', networkDetails);

    // 4. Queue analysis
    const queuedItems = await syncEngine.getQueuedItems();
    const statusCounts = queuedItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('📋 Queue Analysis:', statusCounts);

    // 5. Teste de conectividade
    try {
      const response = await fetch(`${config.serverUrl}/health`);
      console.log('🏥 Server Health:', response.ok ? 'OK' : `Error ${response.status}`);
    } catch (error) {
      console.log('🏥 Server Health: UNREACHABLE -', error.message);
    }

    // 6. Recomendações
    console.log('💡 Recommendations:');
    if (status.pendingItems > 100) {
      console.log('⚠️ Large queue detected. Consider increasing batchSize or sync frequency.');
    }
    if (status.errorItems > 0) {
      console.log('⚠️ Error items detected. Check server connectivity and retry failed items.');
    }
    if (!status.isActive) {
      console.log('⚠️ Sync Engine not active. Call syncEngine.start()');
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
};

// Uso
diagnoseSyncEngine(syncEngine);
```

### Monitoramento Contínuo

```typescript
// Setup para monitoramento contínuo
export const setupSyncMonitoring = (syncEngine: any) => {
  let lastSyncTime = 0;
  let syncFailures = 0;

  syncEngine.addEventListener((event: any) => {
    switch (event.type) {
      case 'sync_completed':
        lastSyncTime = event.timestamp;
        syncFailures = 0; // Reset contador
        console.log('✅ Sync completed successfully');
        break;

      case 'sync_failed':
        syncFailures++;
        console.warn(`❌ Sync failed (${syncFailures} consecutive failures)`, event.error);
        
        if (syncFailures >= 3) {
          console.error('🚨 Multiple sync failures detected! Running diagnostics...');
          diagnoseSyncEngine(syncEngine);
        }
        break;

      case 'item_failed':
        console.warn('⚠️ Item sync failed:', event.data);
        break;
    }
  });

  // Verificar sync health periodicamente
  setInterval(() => {
    const timeSinceLastSync = Date.now() - lastSyncTime;
    if (timeSinceLastSync > 5 * 60 * 1000) { // 5 minutos
      console.warn('⚠️ No successful sync in the last 5 minutes');
    }
  }, 60 * 1000); // Check every minute
};
```

## 🆘 Quando Procurar Ajuda

Se após seguir este guia você ainda encontrar problemas:

1. **Enable Debug Mode**: Configure `debug: true` na inicialização
2. **Colete Logs**: Capture logs detalhados do período do problema
3. **Reproduza o Issue**: Crie um caso mínimo que reproduz o problema
4. **Reporte o Bug**: Abra um issue no GitHub com:
   - Versão do sync-engine-lib
   - Versão do React Native/Expo
   - Plataforma (iOS/Android)
   - Logs e stack trace
   - Passos para reproduzir

Lembre-se: a maioria dos problemas de sincronização se relaciona a conectividade, configuração ou timing. Este guia deve resolver 95% dos casos comuns!