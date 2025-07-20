---
id: instalacao
title: Instalação
---

## Instalação

Para começar a usar a **Sync Engine Lib**, siga os passos abaixo.

## Pré-requisitos

- Node.js >= 18
- React Native >= 0.72 ou Expo SDK >= 50

## 1. Instale a Biblioteca

Adicione a biblioteca principal ao seu projeto:

```bash
yarn add sync-engine-lib
# ou
npm install sync-engine-lib
```

## 2. Instale as Dependências Nativas

A `sync-engine-lib` depende de alguns módulos nativos para acessar o banco de dados local e monitorar a rede. Instale-os no seu projeto:

```bash
npx expo install expo-sqlite @react-native-community/netinfo
```

:::info
Usar `npx expo install` em vez de `yarn` ou `npm` garante que você obtenha a versão da dependência nativa compatível com a sua versão do Expo SDK.
:::

## 3. Configure o Metro (Apenas para Monorepos)

Se você está usando um monorepo (como o projeto de exemplo), precisa garantir que o Metro Bundler consiga resolver os pacotes do workspace. Adicione o seguinte ao seu arquivo `metro.config.js`:

```javascript title="apps/demo-app/metro.config.js"
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../.."); // Ajuste conforme sua estrutura

const config = getDefaultConfig(projectRoot);

// 1. Adicione a pasta de pacotes ao watchFolders
config.watchFolders = [path.join(workspaceRoot, "packages")];

// 2. Adicione o mapeamento do seu pacote
config.resolver.extraNodeModules = {
  "sync-engine-lib": path.join(workspaceRoot, "packages", "sync-engine-lib"),
};

module.exports = config;
```

## Estrutura Recomendada

Recomendamos uma estrutura de monorepo para organizar melhor o seu projeto:

```bash
sync-engine/
├── apps/
│   ├── demo-app/      # Seu aplicativo React Native/Expo
│   └── demo-server/   # (Opcional) Um servidor de exemplo para testes
├── packages/
│   └── sync-engine-lib/ # O código-fonte da biblioteca
└── package.json
```

## Tudo Pronto

Com a biblioteca e suas dependências instaladas, você está pronto para começar a construir sua aplicação offline-first.

**Próximo passo recomendado:** Siga o nosso **[Guia Rápido](/docs/guia-rapido/construindo-um-app-de-todos)** para colocar a mão na massa.
