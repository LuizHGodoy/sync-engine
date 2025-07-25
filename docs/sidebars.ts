import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: "category",
      label: "Introdução",
      collapsed: false,
      items: [
        "introducao/visao-geral",
        "introducao/instalacao",
      ],
    },
    {
      type: "category",
      label: "Guia Rápido",
      collapsed: false,
      items: ["guia-rapido/construindo-um-app-de-todos"],
    },
    {
      type: "category",
      label: "Principais Conceitos",
      collapsed: false,
      items: [
        "principais-conceitos/arquitetura",
        "principais-conceitos/offline-first-engine",
        "principais-conceitos/entidades-e-schema",
        "principais-conceitos/ciclo-de-vida-da-sincronizacao",
      ],
    },
    {
      type: "category",
      label: "Guias Aprofundados",
      collapsed: true,
      items: [
        "guias-aprofundados/crud-offline",
        "guias-aprofundados/adapters-de-sincronizacao",
        "guias-aprofundados/resolucao-de-conflitos",
        "guias-aprofundados/sincronizacao-em-background",
        "guias-aprofundados/politicas-de-retry",
        "guias-aprofundados/monitoramento-de-rede",
        "guias-aprofundados/eventos-e-hooks",
      ],
    },
    {
      type: "category",
      label: "API e Utilitários",
      collapsed: true,
      items: [
        "api-e-utilitarios/configuracao",
        "api-e-utilitarios/sync-engine-factory",
        "api-e-utilitarios/utilitarios",
      ],
    },
    {
      type: "category",
      label: "Testing e Debugging",
      collapsed: true,
      items: [
        "testing-e-debugging/estrategias-de-teste",
        "testing-e-debugging/debugging-offline-sync",
        "testing-e-debugging/mocking-e-simulacao",
        "testing-e-debugging/testes-de-integracao",
      ],
    },
    {
      type: "category",
      label: "Troubleshooting",
      collapsed: true,
      items: [
        "troubleshooting/problemas-comuns",
        "troubleshooting/logs-e-diagnostico",
        "troubleshooting/performance-issues",
        "troubleshooting/network-connectivity",
      ],
    },
  ],
};

export default sidebars;
