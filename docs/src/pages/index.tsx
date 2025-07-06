import React from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

function Logo() {
  // Logo fictício, pode ser trocado depois
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      style={{ marginBottom: 16 }}
    >
      <circle cx="32" cy="32" r="32" fill="#FF9900" />
      <path
        d="M20 44L44 20"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M24 20H44V40"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Hero() {
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <Logo />
        <h1
          className="hero__title"
          style={{ fontWeight: 800, fontSize: "3rem", letterSpacing: -1 }}
        >
          Sync Engine
        </h1>
        <p
          className="hero__subtitle"
          style={{
            fontSize: "1.3rem",
            color: "var(--color-text)",
            marginBottom: 8,
          }}
        >
          Sincronização offline-first para React Native/Expo
        </p>
        <p
          style={{
            maxWidth: 540,
            margin: "0 auto 1.5rem auto",
            color: "var(--color-text)",
            opacity: 0.92,
          }}
        >
          Sincronize dados entre app e servidor, mesmo sem internet. Autosync,
          fila persistente, resolução de conflitos e muito mais!
        </p>
        <div className={styles.buttons}>
          <Link
            className={clsx("button button--lg", styles["button--highlight"])}
            to="/docs/intro"
          >
            Ver documentação 📚
          </Link>
        </div>
      </div>
    </header>
  );
}

function Features() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <div className="col col--4">
            <div className="card">
              <div
                className="card__body"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 36,
                    color: "var(--color-primary)",
                    marginBottom: 8,
                  }}
                >
                  🔌
                </span>
                <h3 style={{ fontWeight: 700 }}>Offline-First</h3>
                <p style={{ textAlign: "center" }}>
                  Funciona 100% offline: todas as operações são salvas
                  localmente e sincronizadas quando a conexão volta.
                </p>
              </div>
            </div>
          </div>
          <div className="col col--4">
            <div className="card">
              <div
                className="card__body"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 36,
                    color: "var(--color-primary)",
                    marginBottom: 8,
                  }}
                >
                  🔄
                </span>
                <h3 style={{ fontWeight: 700 }}>Autosync & Retry</h3>
                <p style={{ textAlign: "center" }}>
                  Sincronização automática, retry inteligente, fila persistente
                  em SQLite e status global.
                </p>
              </div>
            </div>
          </div>
          <div className="col col--4">
            <div className="card">
              <div
                className="card__body"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 36,
                    color: "var(--color-primary)",
                    marginBottom: 8,
                  }}
                >
                  ⚡
                </span>
                <h3 style={{ fontWeight: 700 }}>Plug-and-Play</h3>
                <p style={{ textAlign: "center" }}>
                  Fácil de integrar em qualquer app React Native/Expo.
                  Totalmente tipado em TypeScript.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickStart() {
  return (
    <section className={styles.quickStart}>
      <div className="container">
        <h2 style={{ fontWeight: 700, fontSize: "2rem" }}>Exemplo rápido</h2>
        <pre>
          <code>{`
import { SyncEngineFactory, SyncEngineUtils } from "sync-engine-lib";

const syncEngine = SyncEngineFactory.createForDevelopment("http://localhost:4000");
await syncEngine.initialize();
await syncEngine.start();

// Adiciona item à fila (offline ou online)
await syncEngine.addToQueue(
  SyncEngineUtils.generateId(),
  "todo",
  { text: "Minha tarefa", done: false, createdAt: Date.now(), updatedAt: Date.now() }
);
          `}</code>
        </pre>
      </div>
    </section>
  );
}

function AppScreenshot() {
  return (
    <section className={styles.screenshot}>
      <div className="container" style={{ textAlign: "center" }}>
        <h2 style={{ fontWeight: 700, fontSize: "2rem" }}>
          Veja funcionando na prática
        </h2>
        <img
          src="/img/tela-demo.png"
          alt="Print do app offline-first"
          style={{
            maxWidth: 320,
            borderRadius: 12,
            boxShadow: "0 2px 16px #0003",
            margin: "2rem auto",
          }}
        />
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="Sync Engine"
      description="Sincronização offline-first para React Native/Expo"
    >
      <Hero />
      <Features />
      <QuickStart />
      <AppScreenshot />
    </Layout>
  );
}
