"use client";

import { useEffect } from "react";
import { useAuth } from "../context/auth";
import { useRouter } from "next/navigation";
import FriendsView from "../components/FriendsView";

export default function FriendsPage() {
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
          Amigos
        </h1>
        <a
          href="/"
          style={{ fontSize: "var(--text-sm)", color: "var(--color-brand)" }}
        >
          ← Volver al lienzo
        </a>
      </div>
      <FriendsView />
    </main>
  );
}
