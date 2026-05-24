"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3001/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, password }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message ?? "Error al iniciar sesión");

      login(data.token, data.nickname);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "80px",
      }}
    >
      <h1>Iniciar sesión</h1>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          width: "300px",
        }}
      >
        <input
          type="text"
          placeholder="Email o teléfono"
          value={emailOrPhone}
          onChange={(e) => setEmailOrPhone(e.target.value)}
          required
          style={{ padding: "8px", fontSize: "14px" }}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: "8px", fontSize: "14px" }}
        />
        {error && <p style={{ color: "red", fontSize: "13px" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px", cursor: "pointer" }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <p style={{ textAlign: "center", fontSize: "13px" }}>
          ¿No tienes cuenta? <a href="/register">Regístrate</a>
        </p>
        <p style={{ textAlign: "center", fontSize: "13px" }}>
          <a href="/forgot-password">¿Olvidaste tu contraseña?</a>
        </p>
      </form>
    </main>
  );
}
