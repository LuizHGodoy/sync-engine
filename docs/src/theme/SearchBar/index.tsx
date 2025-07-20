import React, { JSX, useCallback, useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";

interface SearchResult {
  title: string;
  url: string;
  preview: string;
}

export default function SearchBar(): JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchContent = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const searchData: SearchResult[] = [
      {
        title: "Visão Geral",
        url: "/docs/introducao/visao-geral",
        preview:
          "Introdução ao Sync Engine - biblioteca TypeScript para sincronização offline-first",
      },
      {
        title: "Instalação",
        url: "/docs/introducao/instalacao",
        preview:
          "Como instalar e configurar o Sync Engine em seu projeto React Native/Expo",
      },
      {
        title: "Construindo um App de TODOs",
        url: "/docs/guia-rapido/construindo-um-app-de-todos",
        preview:
          "Tutorial prático: construindo um aplicativo de tarefas offline-first completo",
      },
      {
        title: "Arquitetura",
        url: "/docs/principais-conceitos/arquitetura",
        preview:
          "Entenda a arquitetura offline-first e os componentes do Sync Engine",
      },
      {
        title: "Offline-First Engine",
        url: "/docs/principais-conceitos/offline-first-engine",
        preview: "Como funciona o engine de sincronização offline-first",
      },
      {
        title: "Entidades e Schema",
        url: "/docs/principais-conceitos/entidades-e-schema",
        preview: "Definição de entidades e schemas para sincronização",
      },
      {
        title: "Ciclo de Vida da Sincronização",
        url: "/docs/principais-conceitos/ciclo-de-vida-da-sincronizacao",
        preview: "Como funciona o processo completo de sincronização",
      },
      {
        title: "CRUD Offline",
        url: "/docs/guias-aprofundados/crud-offline",
        preview: "Operações Create, Read, Update, Delete em modo offline",
      },
      {
        title: "Adapters de Sincronização",
        url: "/docs/guias-aprofundados/adapters-de-sincronizacao",
        preview: "Como criar e usar adapters customizados para sincronização",
      },
      {
        title: "Resolução de Conflitos",
        url: "/docs/guias-aprofundados/resolucao-de-conflitos",
        preview:
          "Estratégias para resolver conflitos de dados durante sincronização",
      },
      {
        title: "Sincronização em Background",
        url: "/docs/guias-aprofundados/sincronizacao-em-background",
        preview: "Como configurar sincronização automática em background",
      },
      {
        title: "Políticas de Retry",
        url: "/docs/guias-aprofundados/politicas-de-retry",
        preview: "Configuração de tentativas automáticas em caso de falha",
      },
      {
        title: "Monitoramento de Rede",
        url: "/docs/guias-aprofundados/monitoramento-de-rede",
        preview: "Como monitorar e reagir a mudanças de conectividade",
      },
      {
        title: "Eventos e Hooks",
        url: "/docs/guias-aprofundados/eventos-e-hooks",
        preview: "Sistema de eventos e hooks para customização avançada",
      },
      {
        title: "Configuração",
        url: "/docs/api-e-utilitarios/configuracao",
        preview: "Todas as opções de configuração do Sync Engine",
      },
      {
        title: "Sync Engine Factory",
        url: "/docs/api-e-utilitarios/sync-engine-factory",
        preview: "Factory pattern para criação de instâncias do Sync Engine",
      },
      {
        title: "Utilitários",
        url: "/docs/api-e-utilitarios/utilitarios",
        preview: "Funções utilitárias e helpers para desenvolvimento",
      },
      {
        title: "Estratégias de Teste",
        url: "/docs/testing-e-debugging/estrategias-de-teste",
        preview:
          "Como testar aplicações offline-first: unit, integration e e2e tests",
      },
      {
        title: "Debugging Offline Sync",
        url: "/docs/testing-e-debugging/debugging-offline-sync",
        preview: "Ferramentas e técnicas para debug de sincronização offline",
      },
      {
        title: "Mocking e Simulação",
        url: "/docs/testing-e-debugging/mocking-e-simulacao",
        preview: "Como criar mocks e simular cenários de rede e sync",
      },
      {
        title: "Testes de Integração",
        url: "/docs/testing-e-debugging/testes-de-integracao",
        preview: "Testes end-to-end para fluxos completos de sincronização",
      },

      // Troubleshooting
      {
        title: "Problemas Comuns",
        url: "/docs/troubleshooting/problemas-comuns",
        preview: "Soluções para os problemas mais frequentes do Sync Engine",
      },
      {
        title: "Logs e Diagnóstico",
        url: "/docs/troubleshooting/logs-e-diagnostico",
        preview: "Sistema de logging e ferramentas de diagnóstico",
      },
      {
        title: "Performance Issues",
        url: "/docs/troubleshooting/performance-issues",
        preview: "Identificação e solução de problemas de performance",
      },
      {
        title: "Network Connectivity",
        url: "/docs/troubleshooting/network-connectivity",
        preview: "Diagnóstico e soluções para problemas de conectividade",
      },
    ];

    const filteredResults = searchData.filter(
      (result) =>
        result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.preview.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setResults(filteredResults);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchContent(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchContent]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (url: string) => {
    window.location.href = url;
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className={styles.searchContainer} ref={searchRef}>
      <div className={styles.searchBox}>
        <svg
          className={styles.searchIcon}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M19 19L14.65 14.65M17 9C17 13.4183 13.4183 17 9 17C4.58172 17 1 13.4183 1 9C1 4.58172 4.58172 1 9 1C13.4183 1 17 4.58172 17 9Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar na documentação..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className={styles.searchInput}
        />

        {query && (
          <button
            className={styles.clearButton}
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (query || results.length > 0) && (
        <div className={styles.searchResults}>
          {results.length > 0 ? (
            <>
              {results.map((result, index) => (
                <button
                  key={index}
                  className={styles.searchResultItem}
                  onClick={() => handleResultClick(result.url)}
                >
                  <div className={styles.searchResultTitle}>{result.title}</div>
                  <div className={styles.searchResultPreview}>
                    {result.preview}
                  </div>
                </button>
              ))}
            </>
          ) : query ? (
            <div className={styles.noResults}>
              Nenhum resultado encontrado para "{query}"
            </div>
          ) : (
            <div className={styles.searchHint}>
              Digite para buscar na documentação
            </div>
          )}
        </div>
      )}
    </div>
  );
}
