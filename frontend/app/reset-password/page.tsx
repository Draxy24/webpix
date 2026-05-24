"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState(
    searchParams.get("emailOrPhone") ?? "",
  );
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message ?? "Error al restablecer la contraseña");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "80px",
          gap: "16px",
        }}
      >
        <h1>¡Contraseña actualizada! ✓</h1>
        <button
          onClick={() => router.push("/login")}
          style={{ padding: "10px 20px", cursor: "pointer" }}
        >
          Iniciar sesión
        </button>
      </main>
    );
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "80px",
        gap: "16px",
      }}
    >
      <h1>Restablecer contraseña</h1>
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
          type="text"
          placeholder="Código"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          style={{ padding: "8px", fontSize: "14px" }}
        />
        <input
          type="password"
          placeholder="Nueva contraseña"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          style={{ padding: "8px", fontSize: "14px" }}
        />
        {error && <p style={{ color: "red", fontSize: "13px" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px", cursor: "pointer" }}
        >
          {loading ? "Guardando..." : "Restablecer contraseña"}
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main style={{ textAlign: "center", marginTop: "80px" }}>
          Cargando...
        </main>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
