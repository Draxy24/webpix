"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";

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
    const res = await fetch("http://localhost:3001/auth/me", {
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
      const res = await fetch("http://localhost:3001/auth/verify-phone", {
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
    const res = await fetch("http://localhost:3001/auth/resend-verification", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setInfo("Te reenviamos el código.");
  };

  if (loading || checking) {
    return (
      <main style={{ textAlign: "center", marginTop: "80px" }}>
        Cargando...
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
      <h1>Verifica tu cuenta</h1>

      {method === "email" && (
        <div style={{ textAlign: "center", maxWidth: "360px" }}>
          <p>
            Te enviamos un correo con un enlace de verificación. Ábrelo para
            activar tu cuenta.
          </p>
          <p style={{ fontSize: "13px", color: "#aaa" }}>
            Una vez verificado, podrás acceder al lienzo.
          </p>
          <button
            onClick={handleResend}
            style={{ padding: "8px 16px", cursor: "pointer", marginTop: "8px" }}
          >
            Reenviar correo
          </button>
          {info && <p style={{ color: "#4a4", fontSize: "13px" }}>{info}</p>}
        </div>
      )}

      {method === "phone" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "280px",
            textAlign: "center",
          }}
        >
          <p>Ingresa el código de 6 dígitos que enviamos a tu teléfono.</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            style={{
              padding: "8px",
              fontSize: "18px",
              textAlign: "center",
              letterSpacing: "4px",
            }}
          />
          {error && <p style={{ color: "red", fontSize: "13px" }}>{error}</p>}
          <button
            onClick={handleVerifyPhone}
            disabled={submitting || code.length !== 6}
            style={{ padding: "10px", cursor: "pointer" }}
          >
            {submitting ? "Verificando..." : "Verificar"}
          </button>
          <button
            onClick={handleResend}
            style={{ padding: "8px", cursor: "pointer", fontSize: "13px" }}
          >
            Reenviar código
          </button>
          {info && <p style={{ color: "#4a4", fontSize: "13px" }}>{info}</p>}
        </div>
      )}
    </main>
  );
}
