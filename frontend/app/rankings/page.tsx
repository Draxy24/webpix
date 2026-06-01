"use client";

import RankingsView from "../components/RankingsView";

export default function RankingsPage() {
  return (
    <main
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "var(--space-6) var(--space-4)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-4)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display), monospace",
            fontSize: "var(--text-lg)",
          }}
        >
          Rankings
        </h1>
        <a
          href="/"
          style={{ fontSize: "var(--text-sm)", color: "var(--color-brand)" }}
        >
          ← Volver al lienzo
        </a>
      </div>
      <RankingsView />
    </main>
  );
}
