"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";

export default function ReportBugPage() {
  const { token, loading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!token) router.push("/login");
  }, [token, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("http://localhost:3001/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: "BUG", reason: title, details: steps }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message ?? "Error al enviar el reporte");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main style={{ textAlign: "center", marginTop: "80px" }}>
        Cargando...
      </main>
    );
  }

  if (done) {
    return (
      <main
        style={{
          maxWidth: "500px",
          margin: "60px auto",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <h1>¡Gracias por reportar! 🐛</h1>
        <p>
          Tu reporte fue enviado. Nuestro equipo lo revisará para corregir el
          problema.
        </p>
        <button
          onClick={() => router.push("/")}
          style={{ padding: "10px 20px", cursor: "pointer", marginTop: "12px" }}
        >
          Volver al lienzo
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "500px", margin: "60px auto", padding: "20px" }}>
      <a href="/" style={{ fontSize: "13px" }}>
        ← Volver al lienzo
      </a>
      <h1 style={{ marginTop: "12px" }}>Reportar un bug 🐛</h1>
      <p style={{ fontSize: "14px", color: "#aaa" }}>
        Ayúdanos a mejorar WebPix. Describe el problema y, sobre todo, cómo
        llegaste a él para que podamos reproducirlo y corregirlo.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          marginTop: "16px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "13px", fontWeight: "bold" }}>
            ¿Qué salió mal?
          </label>
          <input
            type="text"
            placeholder="Ej: El cooldown no se reinicia al recargar"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ padding: "8px", fontSize: "14px" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "13px", fontWeight: "bold" }}>
            Pasos para reproducirlo <span style={{ color: "#c33" }}>*</span>
          </label>
          <textarea
            placeholder={
              "Ej:\n1. Inicié sesión como usuario PREMIUM\n2. Pinté varios píxeles\n3. Recargué la página\n4. El contador mostraba 20 en vez de ilimitado"
            }
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            required
            rows={7}
            maxLength={1000}
            style={{
              padding: "8px",
              fontSize: "14px",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <span style={{ fontSize: "12px", color: "#888" }}>
            Entre más detallado, más rápido lo podremos arreglar.
          </span>
        </div>

        {error && (
          <p style={{ color: "red", fontSize: "13px", margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || !title.trim() || !steps.trim()}
          style={{ padding: "10px", cursor: "pointer", fontSize: "14px" }}
        >
          {submitting ? "Enviando..." : "Enviar reporte"}
        </button>
      </form>
    </main>
  );
}
