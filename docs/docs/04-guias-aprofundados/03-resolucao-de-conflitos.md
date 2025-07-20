---
id: resolucao-de-conflitos
title: Resolução de Conflitos
---

## Resolução de Conflitos

Um conflito de sincronização ocorre quando um mesmo dado é alterado no cliente e no servidor de forma concorrente. Por exemplo:

1. O usuário A (no celular) fica offline e edita a tarefa "Comprar pão" para "Comprar pão e leite".
2. Enquanto isso, o usuário B (na web) edita a mesma tarefa para "Comprar pão e ovos".
3. O usuário A fica online e a `sync-engine-lib` tenta enviar sua alteração.

O servidor, ao receber a alteração do usuário A, percebe que o dado que ele tem é mais recente do que a versão na qual o usuário A baseou sua alteração. Isso é um conflito. A engine precisa de uma estratégia para decidir o que fazer.

## Configurando uma Estratégia

Você define a estratégia de resolução de conflitos na opção `conflictStrategy` ao criar a `SyncEngine` (ou `OfflineFirstEngine`). A biblioteca já vem com várias estratégias pré-definidas através do objeto `ConflictStrategies`.

```typescript
import { OfflineFirstEngine, ConflictStrategies } from "sync-engine-lib";

const engine = new OfflineFirstEngine({
  adapter: /* ... */,
  entities: { /* ... */ },
  // Define a estratégia de resolução de conflitos
  conflictStrategy: ConflictStrategies.timestampWins(),
});
```

## Estratégias Disponíveis

Aqui estão as estratégias que vêm com a biblioteca:

### `clientWins()`

- **Descrição:** A versão do cliente sempre vence. A alteração local é forçada no servidor, sobrescrevendo a versão do servidor.
- **Quando usar:** Útil em cenários onde a última ação do usuário local deve ter prioridade máxima, mesmo que isso signifique sobrescrever outras alterações.

### `serverWins()`

- **Descrição:** A versão do servidor sempre vence. A alteração local é descartada, e o aplicativo local é atualizado com a versão que está no servidor.
- **Quando usar:** Ideal para cenários onde o servidor é a fonte autoritativa da verdade e as alterações locais são menos críticas.

### `timestampWins()` (Padrão)

- **Descrição:** Compara o timestamp de atualização do dado local com o do servidor. A versão com o timestamp mais recente vence.
- **Quando usar:** Uma abordagem equilibrada e a mais comum. Geralmente funciona bem para a maioria dos casos de uso.

### `merge()`

- **Descrição:** Tenta fazer um "merge" (fusão) simples dos objetos. Ele pega todos os campos da versão do servidor e sobrescreve com os campos da versão do cliente.
- **Quando usar:** Útil se diferentes campos são alterados no cliente e no servidor. **Cuidado:** se o mesmo campo for alterado em ambos, a versão do cliente vencerá para aquele campo.

### `versionBased()`

- **Descrição:** Compara um campo `_version` no dado local e no servidor. A versão com o número maior vence.
- **Quando usar:** Uma abordagem robusta se o seu backend suporta versionamento de registros.

### `manual()`

- **Descrição:** Lança um erro e marca o item com o status `conflict`. Isso interrompe a sincronização para aquele item específico até que uma ação manual seja tomada.
- **Quando usar:** Para dados críticos onde a perda de informação é inaceitável e uma intervenção do usuário ou do desenvolvedor é necessária para resolver o conflito. Você precisaria de uma UI para apresentar o conflito ao usuário.

### `custom(resolveFn)`

- **Descrição:** Permite que você forneça sua própria função de resolução de conflitos.
- **Quando usar:** Quando nenhuma das estratégias pré-definidas atende às suas necessidades e você precisa de uma lógica de negócios complexa para resolver o conflito.

**Exemplo de estratégia customizada:**

```typescript
const minhaEstrategiaCustomizada = ConflictStrategies.custom(
  async (localItem, serverItem) => {
    // Lógica customizada:
    // Para 'todos', concatena o texto. Para outros, o cliente vence.
    if (localItem.type === "todos" && serverItem.text) {
      localItem.payload.text = `${"$"}{localItem.payload.text} (Conflict: ${"$"}{serverItem.text})`;
    }

    // Retorna o item local modificado que será enviado ao servidor
    return localItem;
  }
);

const engine = new OfflineFirstEngine({
  // ...
  conflictStrategy: minhaEstrategiaCustomizada,
});
```
