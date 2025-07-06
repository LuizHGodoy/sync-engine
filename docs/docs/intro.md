---
id: intro
title: Instalação
sidebar_position: 2
---

# Instalação

A Sync Engine é uma biblioteca TypeScript para sincronização offline-first em React Native/Expo.

## Pré-requisitos

- Node.js >= 18
- React Native ou Expo SDK 53+

## Instale a biblioteca

```bash
yarn add sync-engine-lib
# ou
npm install sync-engine-lib
```

## Instale as peer dependencies

```bash
yarn add expo-sqlite @react-native-community/netinfo
```

## Estrutura recomendada

- `packages/sync-engine-lib`: a biblioteca de sync
- `apps/demo-app`: seu app Expo/React Native
- `apps/demo-server`: servidor de teste (opcional)

## Próximos passos

- [Como funciona](./how-it-works)
- [API e exemplos](./api)
- [FAQ](./faq)
