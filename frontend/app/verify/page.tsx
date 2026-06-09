"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";
import AuthPageLayout from "../components/AuthPageLayout";
import Button from "../components/Button";
import styles from "../components/AuthForm.module.css";
import { API_URL } from "@/app/lib/api";

export default function VerifyPage() {
  const { token, loading } = useAuth();
  const router = useRouter();

  const [method, setMethod] = useState<"email" | "phone" | null>(null);
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!token) return;
    const res = await fetch(API_URL + "/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.verified) {
      router.push("/");
      return;
    }
    setMethod(data.needsVerification);
    setChecking(false);
  }, [token, router]);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    checkStatus();
  }, [token, loading, router, checkStatus]);

  const handleVerifyPhone = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(API_URL + "/auth/verify-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Código inválido");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setInfo("");
    const res = await fetch(API_URL + "/auth/resend-verification", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setInfo("Te reenviamos el código.");
  };

  if (loading || checking) {
    return (
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
    );
  }

  return (
    <AuthPageLayout title="Verifica tu cuenta">
      {method === "email" && (
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
            Te enviamos un correo con un enlace de verificación. Ábrelo para
            activar tu cuenta.
          </p>
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              textAlign: "center",
              margin: 0,
            }}
          >
            Una vez verificado, podrás acceder al lienzo.
          </p>
          <Button variant="secondary" fullWidth onClick={handleResend}>
            Reenviar correo
          </Button>
          {info && (
            <p
              style={{
                color: "var(--color-success)",
                fontSize: "var(--text-xs)",
                textAlign: "center",
                margin: 0,
              }}
            >
              {info}
            </p>
          )}
        </div>
      )}

      {method === "phone" && (
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
            Ingresa el código de 6 dígitos que enviamos a tu teléfono.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={styles.input}
            style={{
              textAlign: "center",
              fontSize: "var(--text-lg)",
              letterSpacing: "4px",
            }}
          />
          {error && <p className={styles.error}>{error}</p>}
          <Button
            fullWidth
            size="lg"
            onClick={handleVerifyPhone}
            disabled={submitting || code.length !== 6}
          >
            {submitting ? "Verificando..." : "Verificar"}
          </Button>
          <Button variant="ghost" fullWidth onClick={handleResend}>
            Reenviar código
          </Button>
          {info && (
            <p
              style={{
                color: "var(--color-success)",
                fontSize: "var(--text-xs)",
                textAlign: "center",
                margin: 0,
              }}
            >
              {info}
            </p>
          )}
        </div>
      )}
    </AuthPageLayout>
  );
}
