"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AuthPageLayout from "../components/AuthPageLayout";
import Button from "../components/Button";
import { API_URL } from "@/app/lib/api";

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
      const res = await fetch(API_URL + "/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setStatus(res.ok ? "success" : "error");
    };
    verify();
  }, [code]);

  if (status === "verifying") {
    return (
      <AuthPageLayout title="Verificando...">
        <p
          style={{
            textAlign: "center",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          Validando tu enlace de verificación.
        </p>
      </AuthPageLayout>
    );
  }

  if (status === "success") {
    return (
      <AuthPageLayout title="¡Cuenta verificada!">
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
            Tu correo ha sido verificado correctamente.
          </p>
          <Button fullWidth size="lg" onClick={() => router.push("/")}>
            Ir al lienzo
          </Button>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title="Enlace inválido">
      <p
        style={{
          textAlign: "center",
          color: "var(--color-text-secondary)",
          margin: 0,
        }}
      >
        El enlace de verificación es inválido o ha expirado.
      </p>
    </AuthPageLayout>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailInner />
    </Suspense>
  );
}
