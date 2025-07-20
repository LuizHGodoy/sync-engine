---
id: visao-geral
title: Visão Geral
---

## Visão Geral da Sync Engine Lib

A **Sync Engine Lib** é uma biblioteca TypeScript robusta e flexível, projetada para simplificar a implementação de funcionalidades **offline-first** em aplicativos React Native e Expo. O objetivo principal é permitir que seu aplicativo continue funcionando perfeitamente, mesmo sem conexão com a internet, sincronizando os dados de forma automática e transparente quando a rede estiver disponível.

## O Problema que Resolvemos

Em um mundo móvel, a conectividade é inconstante. Aplicações que dependem de uma conexão permanente com o servidor para funcionar resultam em uma experiência de usuário frustrante, com telas de carregamento, erros de rede e perda de dados.

A abordagem offline-first inverte essa lógica: o aplicativo opera primariamente sobre um banco de dados local, garantindo uma UI sempre rápida e responsiva. As operações de rede (sincronização) ocorrem em segundo plano, de forma assíncrona.

## Principais Features

<div style={{display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '2rem'}}>
  <div style={{flex: 1, minWidth: 220, background: 'var(--ifm-card-background-color)', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px #0002'}}>
    <b>🚀 Experiência de UI Imediata</b>
    <p style={{margin: 0}}>Todas as operações (CRUD) são locais e instantâneas. Chega de spinners de carregamento para ações do usuário.</p>
  </div>
  <div style={{flex: 1, minWidth: 220, background: 'var(--ifm-card-background-color)', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px #0002'}}>
    <b>🔄 Sincronização Automática</b>
    <p style={{margin: 0}}>Uma fila de operações persistente (Outbox Pattern) e um worker em background garantem que os dados sejam sincronizados de forma inteligente e automática.</p>
  </div>
  <div style={{flex: 1, minWidth: 220, background: 'var(--ifm-card-background-color)', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px #0002'}}>
    <b>🔌 Backend Agnóstico</b>
    <p style={{margin: 0}}>Com um sistema de Adapters, você pode conectar a biblioteca a qualquer tipo de backend (REST, GraphQL, Firebase, etc.) escrevendo uma simples camada de integração.</p>
  </div>
    <div style={{flex: 1, minWidth: 220, background: 'var(--ifm-card-background-color)', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px #0002'}}>
    <b>🧩 Altamente Configurável</b>
    <p style={{margin: 0}}>Ajuste tudo, desde estratégias de resolução de conflitos e políticas de retry até a forma como a sincronização em background funciona.</p>
  </div>
</div>

## Como Funciona em 30 Segundos

1. **Defina suas Entidades:** Você define o "schema" dos seus dados (ex: `todos`, `posts`). A biblioteca cria as tabelas no banco de dados local (SQLite).
2. **Opere Localmente:** Seu app realiza operações CRUD (criar, ler, atualizar, deletar) diretamente no banco local através de uma API simples: `engine.table('todos').create(...)`.
3. **A Mágica Acontece:** Cada operação é adicionada a uma fila. Um worker inteligente observa essa fila e a conexão de rede. Quando online, ele envia as operações para seu servidor através de um "Adapter" que você define.

## Próximos Passos

- **[Instalação](/docs/introducao/instalacao)**: Comece a usar a biblioteca em seu projeto.
- **[Guia Rápido](/docs/guia-rapido/construindo-um-app-de-todos)**: Crie um app de tarefas offline-first em poucos minutos.
