"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "80px",
        gap: "16px",
      }}
    >
      <h1>Recuperar contraseña</h1>
      {submitted ? (
        <div style={{ textAlign: "center", maxWidth: "360px" }}>
          <p>
            Si existe una cuenta asociada, te enviamos instrucciones para
            recuperar tu contraseña.
          </p>
          <button
            onClick={() => router.push("/reset-password")}
            style={{ padding: "8px 16px", cursor: "pointer", marginTop: "8px" }}
          >
            Ya tengo mi código
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "300px",
          }}
        >
          <p style={{ fontSize: "13px", color: "#aaa", textAlign: "center" }}>
            Ingresa tu correo o teléfono y te enviaremos instrucciones.
          </p>
          <input
            type="text"
            placeholder="Email o teléfono"
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            required
            style={{ padding: "8px", fontSize: "14px" }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "10px", cursor: "pointer" }}
          >
            {loading ? "Enviando..." : "Enviar instrucciones"}
          </button>
          <p style={{ textAlign: "center", fontSize: "13px" }}>
            <a href="/login">Volver a iniciar sesión</a>
          </p>
        </form>
      )}
    </main>
  );
}
