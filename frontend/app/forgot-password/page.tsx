"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthPageLayout from "../components/AuthPageLayout";
import Button from "../components/Button";
import styles from "../components/AuthForm.module.css";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch("http://localhost:3001/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrPhone }),
    });
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <AuthPageLayout title="Recuperar contraseña">
      {submitted ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              margin: 0,
            }}
          >
            Si existe una cuenta asociada, te enviamos instrucciones para
            recuperar tu contraseña.
          </p>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => router.push("/reset-password")}
          >
            Ya tengo mi código
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              textAlign: "center",
              margin: 0,
            }}
          >
            Ingresa tu correo o teléfono y te enviaremos instrucciones.
          </p>
          <input
            type="text"
            placeholder="Email o teléfono"
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            required
            className={styles.input}
          />
          <Button type="submit" disabled={loading} fullWidth size="lg">
            {loading ? "Enviando..." : "Enviar instrucciones"}
          </Button>
          <p
            style={{
              textAlign: "center",
              fontSize: "var(--text-sm)",
              margin: 0,
            }}
          >
            <a href="/login" style={{ color: "var(--color-brand)" }}>
              Volver a iniciar sesión
            </a>
          </p>
        </form>
      )}
    </AuthPageLayout>
  );
}
