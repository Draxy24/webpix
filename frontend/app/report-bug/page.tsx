"use client";

import { useEffect } from "react";
import { useAuth } from "../context/auth";
import { useRouter } from "next/navigation";
import BugReportView from "../components/BugReportView";

export default function ReportBugPage() {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!token) router.push("/login");
  }, [token, loading, router]);

  if (loading || !token) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-secondary)",
        }}
      >
        Cargando...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          width: "480px",
          maxWidth: "100%",
          padding: "var(--space-6)",
          background: "var(--color-surface)",
          border: "var(--border-normal) solid var(--color-border-strong)",
          borderRadius: "var(--radius-lg)",
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
            Reportar un bug 🐛
          </h1>
          <a
            href="/"
            style={{ fontSize: "var(--text-sm)", color: "var(--color-brand)" }}
          >
            ← Volver
          </a>
        </div>
        <BugReportView />
      </div>
    </main>
  );
}
