---
id: sync-engine-factory
title: SyncEngineFactory
---

## SyncEngineFactory

Para simplificar a criação e configuração de uma instância da `SyncEngine`, a biblioteca fornece um `SyncEngineFactory`. Ele oferece métodos para criar uma engine com configurações pré-definidas para diferentes ambientes, como desenvolvimento e produção.

:::info Nota
O `SyncEngineFactory` cria instâncias da `SyncEngine` de baixo nível. Para a maioria dos casos de uso, recomendamos usar a `OfflineFirstEngine`, que é uma abstração de mais alto nível. No entanto, a factory é útil se você precisar de um controle mais granular.
:::

## Como Usar

Em vez de criar o objeto de configuração manualmente, você pode usar um dos métodos da factory.

```typescript
import { SyncEngineFactory } from "sync-engine-lib";

// Cria uma engine otimizada para o ambiente de desenvolvimento
const devEngine = SyncEngineFactory.createForDevelopment(
  "http://localhost:4000"
);

// Cria uma engine com configurações robustas para produção
const prodEngine = SyncEngineFactory.createForProduction(
  "https://api.meuapp.com"
);

await devEngine.initialize();
devEngine.start();
```

## Métodos da Factory

### `createForDevelopment(serverUrl, options?)`

Cria uma engine com configurações otimizadas para o desenvolvimento:

- **Debug:** Habilitado (`debug: true`).
- **Intervalo de Sync:** Curto (15 segundos), para ver as alterações rapidamente.
- **Estratégia de Conflito:** `timestampWins()`.

### `createForProduction(serverUrl, options?)`

Cria uma engine com configurações mais conservadoras e seguras para um ambiente de produção:

- **Debug:** Desabilitado (`debug: false`).
- **Intervalo de Sync:** Mais longo (30 segundos), para economizar bateria e rede.
- **Tamanho do Lote:** Maior (25 itens).
- **Estratégia de Conflito:** `timestampWins()`.

### `createConservative(serverUrl, options?)`

Cria uma engine com configurações muito conservadoras:

- **Intervalo de Sync:** Muito longo (1 minuto).
- **Tamanho do Lote:** Pequeno (5 itens).
- **Retries:** Mais tentativas (5).
- **Estratégia de Conflito:** `manual()`, forçando a resolução manual de conflitos para evitar perda de dados.
- **Ideal para:** Aplicativos onde a integridade dos dados é absolutamente crítica e o consumo de recursos deve ser mínimo.

### `createAggressive(serverUrl, options?)`

Cria uma engine com configurações agressivas para sincronização quase em tempo real:

- **Intervalo de Sync:** Muito curto (5 segundos).
- **Tamanho do Lote:** Muito grande (50 itens).
- **Retries:** Menos tentativas (2).
- **Estratégia de Conflito:** `clientWins()`, para garantir que a última ação do usuário seja enviada rapidamente.
- **Ideal para:** Aplicativos de colaboração em tempo real, como chats ou documentos compartilhados.

### Personalizando as Opções

Todos os métodos da factory aceitam um segundo argumento `options` opcional, que permite sobrescrever qualquer uma das configurações padrão daquela factory.

```typescript
const prodEngineCustomizado = SyncEngineFactory.createForProduction(
  "https://api.meuapp.com",
  {
    // Sobrescreve a estratégia de conflito padrão da factory
    conflictStrategy: ConflictStrategies.serverWins(),
    // Sobrescreve uma opção de configuração específica
    config: {
      syncInterval: 90000, // Aumenta o intervalo para 90 segundos
    },
  }
);
```
