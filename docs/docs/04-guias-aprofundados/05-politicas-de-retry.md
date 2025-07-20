---
id: politicas-de-retry
title: Políticas de Retry
---

# Políticas de Retry (Novas Tentativas)

Quando uma operação de sincronização falha devido a um erro temporário (como falta de conexão de rede ou um erro 503 do servidor), a `sync-engine-lib` não desiste imediatamente. Em vez disso, ela usa uma **Política de Retry** para tentar novamente a operação mais tarde.

Essa lógica é crucial para a resiliência de um aplicativo offline-first, garantindo que os dados eventualmente cheguem ao servidor sem a necessidade de intervenção do usuário.

## A Estratégia de Exponential Backoff

Por padrão, a biblioteca utiliza uma estratégia de **Exponential Backoff with Jitter**. Isso significa que:
1.  A cada falha, o tempo de espera para a próxima tentativa aumenta exponencialmente.
2.  Um pequeno fator aleatório ("jitter") é adicionado a esse tempo de espera para evitar que múltiplos clientes tentem novamente exatamente ao mesmo tempo, o que poderia sobrecarregar o servidor (problema conhecido como "thundering herd").

## Configurando a Política de Retry

A `RetryPolicy` é gerenciada internamente pela `SyncEngine` e `BackgroundSyncWorker`. Você pode influenciar seu comportamento através das opções de configuração `sync` na `OfflineFirstEngine`.

```typescript
const engine = new OfflineFirstEngine({
  adapter: /* ... */,
  entities: { /* ... */ },
  sync: {
    maxRetries: 5,        // Tentar no máximo 5 vezes
    retryDelay: 2000,     // Atraso inicial de 2 segundos
    // O backoff multiplier não é diretamente configurável aqui,
    // mas a lógica interna o utiliza.
  },
});
```

-   `maxRetries`: O número máximo de tentativas para uma operação antes de marcá-la como `failed` permanentemente.
-   `retryDelay`: O tempo de espera base (em milissegundos) antes da primeira nova tentativa.

## Usando Políticas Pré-definidas (`RetryPolicies`)

A biblioteca também exporta um objeto `RetryPolicies` com várias configurações pré-definidas, caso você precise de um controle mais granular em um cenário customizado (não é usado diretamente na config da `OfflineFirstEngine`, mas é bom conhecer).

```typescript
import { RetryPolicies } from "sync-engine-lib";

// Uma política que tenta 5 vezes com um atraso inicial longo.
const politicaConservadora = RetryPolicies.conservative();

// Uma política que tenta poucas vezes e com atrasos curtos.
const politicaAgressiva = RetryPolicies.aggressive();

// Exemplo de como usar uma política customizada
async function minhaOperacaoDeRede() {
  return politicaAgressiva.executeWithRetry(async () => {
    // sua chamada fetch() aqui
    const response = await fetch("https://api.meuservidor.com/data");
    if (!response.ok) {
      throw new Error("Falha na rede");
    }
    return response.json();
  });
}
```

### Políticas Disponíveis:

-   `RetryPolicies.conservative()`: Menos tentativas, maiores intervalos. Ideal para operações não críticas e para economizar bateria.
-   `RetryPolicies.aggressive()`: Mais tentativas, intervalos curtos. Bom para dados que precisam ser sincronizados rapidamente, mas pode consumir mais bateria e rede.
-   `RetryPolicies.default()`: Uma política balanceada, usada como padrão interno.
-   `RetryPolicies.fast()`: Para cenários que exigem feedback quase em tempo real.
-   `RetryPolicies.optimized()`: Uma configuração otimizada que busca um bom equilíbrio entre rapidez e consumo de recursos.

## O que Acontece Quando Todas as Tentativas Falham?

Se uma operação excede o `maxRetries`, seu status na fila (`outbox`) é permanentemente alterado para `failed`. A engine não tentará mais sincronizar esta operação automaticamente.

Neste ponto, você precisaria de uma lógica no seu aplicativo para lidar com isso, como:
-   Apresentar um erro na UI, permitindo que o usuário tente reenviar manualmente.
-   Registrar o erro em um serviço de monitoramento (logging).
-   Oferecer a opção de descartar a alteração.

Você pode encontrar esses itens buscando por operações com status `failed` na `QueueStorage`.
