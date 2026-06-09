"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AuthPageLayout from "../components/AuthPageLayout";
import Button from "../components/Button";
import styles from "../components/AuthForm.module.css";
import { API_URL } from "@/app/lib/api";

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
      const res = await fetch(API_URL + "/auth/reset-password", {
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
      <AuthPageLayout title="¡Contraseña actualizada!">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              textAlign: "center",
              margin: 0,
            }}
          >
            Tu contraseña ha sido restablecida correctamente.
          </p>
          <Button fullWidth size="lg" onClick={() => router.push("/login")}>
            Iniciar sesión
          </Button>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title="Restablecer contraseña">
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          placeholder="Email o teléfono"
          value={emailOrPhone}
          onChange={(e) => setEmailOrPhone(e.target.value)}
          required
          className={styles.input}
        />
        <input
          type="text"
          placeholder="Código"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          className={styles.input}
        />
        <input
          type="password"
          placeholder="Nueva contraseña"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className={styles.input}
        />
        {error && <p className={styles.error}>{error}</p>}
        <Button type="submit" disabled={loading} fullWidth size="lg">
          {loading ? "Guardando..." : "Restablecer contraseña"}
        </Button>
      </form>
    </AuthPageLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthPageLayout title="Cargando...">
          <p
            style={{
              textAlign: "center",
              color: "var(--color-text-secondary)",
              margin: 0,
            }}
          >
            ...
          </p>
        </AuthPageLayout>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
