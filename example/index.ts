/**
 * Exemplo de uso da Sync Engine Lib
 */

import { 
  SyncEngineFactory, 
  SyncEngineUtils, 
  ConflictStrategies,
  SyncEngine 
} from '../src/index';

// Exemplo 1: Configuração simples para desenvolvimento
async function exemploBasico() {
  console.log('=== Exemplo Básico ===');
  
  const syncEngine = SyncEngineFactory.createForDevelopment('https://api.exemplo.com');
  
  await syncEngine.initialize();
  await syncEngine.start();
  
  // Adiciona alguns items à queue
  await syncEngine.addToQueue(
    SyncEngineUtils.generateId(),
    'user_profile',
    {
      name: 'João Silva',
      email: 'joao@exemplo.com',
      updatedAt: Date.now(),
    }
  );
  
  await syncEngine.addToQueue(
    SyncEngineUtils.generateId(),
    'checkin',
    {
      location: { lat: -23.550520, lng: -46.633308 },
      timestamp: Date.now(),
      notes: 'Check-in no escritório',
    }
  );
  
  // Verifica status
  const status = await syncEngine.getStatus();
  console.log('Status:', status);
  
  // Força sincronização (vai falhar por não ter servidor real)
  try {
    const result = await syncEngine.forceSync();
    console.log('Resultado do sync:', result);
  } catch (error) {
    console.log('Erro esperado (sem servidor):', error.message);
  }
  
  await syncEngine.destroy();
}

// Exemplo 2: Configuração avançada com hooks e estratégias
async function exemploAvancado() {
  console.log('\n=== Exemplo Avançado ===');
  
  const config = SyncEngineUtils.createDefaultConfig('https://api.exemplo.com');
  
  const syncEngine = new SyncEngine({
    config: {
      ...config,
      batchSize: 5,
      syncInterval: 10000, // 10 segundos
    },
    conflictStrategy: ConflictStrategies.smartMerge(['id', 'userId', 'createdAt']),
    debug: true,
    hooks: {
      onBeforeSync: async (items) => {
        console.log(`🔄 Iniciando sync de ${items.length} items`);
      },
      onSyncSuccess: async (items) => {
        console.log(`✅ Sync concluído com sucesso`);
      },
      onSyncError: async (error, items) => {
        console.log(`❌ Erro no sync: ${error.message}`);
      },
      onQueueChange: async (status) => {
        console.log(`📊 Status da queue: ${status.pendingItems} pendentes, ${status.errorItems} com erro`);
      },
      onConnectionChange: async (isOnline) => {
        console.log(`📡 Conexão: ${isOnline ? 'online' : 'offline'}`);
      },
    },
  });
  
  // Adiciona listener de eventos
  syncEngine.addEventListener((event) => {
    console.log(`🎭 Evento: ${event.type}`, event.data || '');
  });
  
  await syncEngine.initialize();
  await syncEngine.start();
  
  // Simula dados de um app de e-commerce
  const produtos = [
    { id: '1', nome: 'Smartphone', preco: 999.99 },
    { id: '2', nome: 'Notebook', preco: 2499.99 },
    { id: '3', nome: 'Tablet', preco: 699.99 },
  ];
  
  for (const produto of produtos) {
    await syncEngine.addToQueue(
      SyncEngineUtils.generateId(),
      'produto',
      produto
    );
  }
  
  // Simula pedido
  await syncEngine.addToQueue(
    SyncEngineUtils.generateId(),
    'pedido',
    {
      items: [
        { produtoId: '1', quantidade: 1 },
        { produtoId: '3', quantidade: 2 },
      ],
      total: 2399.97,
      clienteId: 'cliente_123',
      timestamp: Date.now(),
    }
  );
  
  const finalStatus = await syncEngine.getStatus();
  console.log('Status final:', finalStatus);
  
  await syncEngine.destroy();
}

// Exemplo 3: Estratégias de conflito
async function exemploConflitos() {
  console.log('\n=== Exemplo Estratégias de Conflito ===');
  
  // Simula diferentes estratégias
  const estrategias = [
    { nome: 'Cliente Vence', estrategia: ConflictStrategies.clientWins() },
    { nome: 'Servidor Vence', estrategia: ConflictStrategies.serverWins() },
    { nome: 'Timestamp Vence', estrategia: ConflictStrategies.timestampWins() },
    { nome: 'Merge Simples', estrategia: ConflictStrategies.merge() },
  ];
  
  for (const { nome, estrategia } of estrategias) {
    console.log(`\n--- Testando: ${nome} ---`);
    
    const syncEngine = SyncEngineFactory.createForDevelopment('https://api.exemplo.com', {
      conflictStrategy: estrategia,
    });
    
    await syncEngine.initialize();
    
    // Adiciona item que pode gerar conflito
    await syncEngine.addToQueue(
      'item_conflito',
      'documento',
      {
        titulo: 'Documento Local',
        conteudo: 'Versão editada localmente',
        version: 1,
        updatedAt: Date.now(),
      }
    );
    
    console.log(`Estratégia configurada: ${estrategia.name}`);
    
    await syncEngine.destroy();
  }
}

// Exemplo 4: Utilitários
async function exemploUtilitarios() {
  console.log('\n=== Exemplo Utilitários ===');
  
  // Validação de configuração
  const configInvalida = {
    serverUrl: '',
    batchSize: -1,
    syncInterval: 0,
    maxRetries: -5,
    initialRetryDelay: -100,
    backoffMultiplier: 0.5,
    requestTimeout: 0,
  } as any;
  
  const validacao = SyncEngineUtils.validateConfig(configInvalida);
  console.log('Validação (deve ter erros):', validacao);
  
  // Configuração válida
  const configValida = SyncEngineUtils.createDefaultConfig('https://api.valida.com');
  const validacaoValida = SyncEngineUtils.validateConfig(configValida);
  console.log('Validação (deve ser válida):', validacaoValida);
  
  // Geração de IDs únicos
  const ids = Array.from({ length: 5 }, () => SyncEngineUtils.generateId());
  console.log('IDs gerados:', ids);
}

// Executar exemplos
async function executarExemplos() {
  try {
    await exemploBasico();
    await exemploAvancado();
    await exemploConflitos();
    await exemploUtilitarios();
    
    console.log('\n✅ Todos os exemplos executados com sucesso!');
  } catch (error) {
    console.error('❌ Erro nos exemplos:', error);
  }
}

// Executa se for o arquivo principal
if (require.main === module) {
  executarExemplos();
}

export {
  exemploBasico,
  exemploAvancado,
  exemploConflitos,
  exemploUtilitarios,
};
