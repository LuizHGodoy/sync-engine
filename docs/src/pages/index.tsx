import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import clsx from "clsx";
import styles from "./index.module.css";

function SyncEngineIcon() {
  return (
    <div className={styles.iconContainer}>
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        className={styles.mainIcon}
      >
        <defs>
          <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF9900" />
            <stop offset="100%" stopColor="#FF6600" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r="40" fill="url(#iconGradient)" />

        <path
          d="M25 30 L35 20 L33 18 M35 20 L33 22"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55 50 L45 60 L47 62 M45 60 L47 58"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <rect
          x="20"
          y="35"
          width="40"
          height="20"
          rx="3"
          fill="#fff"
          fillOpacity="0.9"
        />
        <rect x="23" y="38" width="34" height="3" rx="1" fill="#FF9900" />
        <rect
          x="23"
          y="43"
          width="25"
          height="2"
          rx="1"
          fill="#FF9900"
          fillOpacity="0.6"
        />
        <rect
          x="23"
          y="47"
          width="18"
          height="2"
          rx="1"
          fill="#FF9900"
          fillOpacity="0.4"
        />
      </svg>
    </div>
  );
}

function Hero() {
  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className="container">
        <SyncEngineIcon />
        <h1 className={styles.heroTitle}>Sync Engine</h1>
        <p className={styles.heroSubtitle}>
          Biblioteca TypeScript para sincronização offline-first
        </p>
        <p className={styles.heroDescription}>
          Sincronize dados entre aplicativo e servidor, mesmo sem conexão à
          internet. Inclui queue persistente, resolução de conflitos, retry
          automático e muito mais.
        </p>
        <div className={styles.buttons}>
          <Link
            className={clsx("button button--lg", styles.buttonPrimary)}
            to="/docs/introducao/visao-geral"
          >
            Começar Agora
          </Link>
          <Link
            className={clsx(
              "button button--lg button--outline",
              styles.buttonSecondary
            )}
            to="/docs/guia-rapido/construindo-um-app-de-todos"
          >
            Ver Tutorial
          </Link>
        </div>
      </div>
    </header>
  );
}

function Features() {
  const features = [
    {
      icon: "🔌",
      title: "Offline-First",
      description:
        "Funciona completamente offline. Todas as operações são salvas localmente e sincronizadas automaticamente quando a conexão é restabelecida.",
    },
    {
      icon: "⚡",
      title: "Ultra Leve & Rápida",
      description:
        "Apenas 13.3KB gzipado - menor que Axios! Otimizada para React Native/Expo com SQLite local, batch processing e zero dependencies em runtime.",
    },
    {
      icon: "🔄",
      title: "Sync Inteligente",
      description:
        "Retry automático com backoff exponencial, detecção de conflitos, e estratégias customizáveis de resolução.",
    },
    {
      icon: "🛠️",
      title: "Developer Experience",
      description:
        "API simples e intuitiva, totalmente tipada em TypeScript, com debugging tools e documentação completa.",
    },
    {
      icon: "📊",
      title: "Monitoramento",
      description:
        "Dashboard de status em tempo real, logs estruturados, métricas de performance e health checks automáticos.",
    },
    {
      icon: "🔒",
      title: "Confiável",
      description:
        "Tratamento robusto de edge cases, testes abrangentes, e arquitetura battle-tested em aplicações de produção.",
    },
  ];

  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.featuresHeader}>
          <h2>Por que usar o Sync Engine?</h2>
          <p>
            Construído especificamente para aplicações React Native que precisam
            funcionar offline
          </p>
        </div>
        <div className="row">
          {features.map((feature, idx) => (
            <div key={idx} className="col col--4">
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const useCases = [
    {
      title: "Apps de Produtividade",
      description: "TODOs, notas, calendários que funcionam offline",
      examples: ["Tarefas", "Anotações", "Agendas"],
    },
    {
      title: "E-commerce & Vendas",
      description: "Catálogos, carrinho, pedidos mesmo sem internet",
      examples: ["Produtos", "Carrinho", "Checkout"],
    },
    {
      title: "Apps Corporativos",
      description: "CRM, ERP, formulários de campo",
      examples: ["Vendas", "Inventário", "Relatórios"],
    },
  ];

  return (
    <section className={styles.useCases}>
      <div className="container">
        <div className={styles.useCasesHeader}>
          <h2>Casos de Uso</h2>
          <p>Ideal para qualquer aplicação que precisa funcionar offline</p>
        </div>
        <div className="row">
          {useCases.map((useCase, idx) => (
            <div key={idx} className="col col--4">
              <div className={styles.useCaseCard}>
                <h3>{useCase.title}</h3>
                <p>{useCase.description}</p>
                <div className={styles.useCaseExamples}>
                  {useCase.examples.map((example, i) => (
                    <span key={i} className={styles.useCaseTag}>
                      {example}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { number: "13.3KB", label: "Gzipped Size" },
    { number: "100%", label: "TypeScript" },
    { number: "MIT", label: "License" },
    { number: "Zero", label: "Runtime Dependencies" },
  ];

  return (
    <section className={styles.stats}>
      <div className="container">
        <div className="row">
          {stats.map((stat, idx) => (
            <div key={idx} className="col col--3">
              <div className={styles.statCard}>
                <div className={styles.statNumber}>{stat.number}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className={styles.cta}>
      <div className="container">
        <div className={styles.ctaContent}>
          <h2>Pronto para começar?</h2>
          <p>
            Adicione sincronização offline ao seu app React Native em minutos
          </p>
          <div className={styles.buttons}>
            <Link
              className={clsx("button button--lg", styles.buttonPrimary)}
              to="/docs/introducao/instalacao"
            >
              Instalar Agora
            </Link>
            <Link
              className={clsx(
                "button button--lg button--outline",
                styles.buttonSecondary
              )}
              to="/docs/guia-rapido/construindo-um-app-de-todos"
            >
              Ver Exemplo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="Sync Engine - Sincronização Offline-First"
      description="Biblioteca TypeScript para sincronização offline-first em React Native/Expo. Queue persistente, resolução de conflitos, retry automático."
    >
      <Hero />
      <Stats />
      <Features />
      <UseCases />
      <CallToAction />
    </Layout>
  );
}
