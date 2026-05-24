"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code");
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );

  useEffect(() => {
    if (!code) {
      setStatus("error");
      return;
    }
    const verify = async () => {
      const res = await fetch("http://localhost:3001/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setStatus(res.ok ? "success" : "error");
    };
    verify();
  }, [code]);

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
      {status === "verifying" && <p>Verificando...</p>}
      {status === "success" && (
        <>
          <h1>¡Cuenta verificada! ✓</h1>
          <p>Tu correo ha sido verificado correctamente.</p>
          <button
            onClick={() => router.push("/")}
            style={{ padding: "10px 20px", cursor: "pointer" }}
          >
            Ir al lienzo
          </button>
        </>
      )}
      {status === "error" && (
        <>
          <h1>Enlace inválido</h1>
          <p>El enlace de verificación es inválido o ha expirado.</p>
        </>
      )}
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main style={{ textAlign: "center", marginTop: "80px" }}>
          Cargando...
        </main>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
