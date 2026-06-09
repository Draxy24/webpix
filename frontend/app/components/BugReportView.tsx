"use client";

import { useState } from "react";
import { useAuth } from "../context/auth";
import Button from "./Button";
import styles from "./BugReportView.module.css";
import { API_URL } from "@/app/lib/api";

export default function BugReportView() {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(API_URL + "/reports", {
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

  if (!token) {
    return (
      <p className={styles.muted}>
        Inicia sesión para reportar un bug. Abre la hamburguesa y entra desde la
        pestaña Perfil.
      </p>
    );
  }

  if (done) {
    return (
      <div className={styles.success}>
        <div className={styles.successTitle}>¡Gracias por reportar! 🐛</div>
        <p className={styles.successText}>
          Tu reporte fue enviado. Nuestro equipo lo revisará para corregir el
          problema.
        </p>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setTitle("");
            setSteps("");
            setDone(false);
          }}
        >
          Reportar otro
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.container}>
      <p className={styles.intro}>
        Ayúdanos a mejorar WebPix. Describe el problema y, sobre todo, cómo
        llegaste a él para que podamos reproducirlo y corregirlo.
      </p>

      <div className={styles.field}>
        <label className={styles.label}>¿Qué salió mal?</label>
        <input
          type="text"
          placeholder="Ej: El cooldown no se reinicia al recargar"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Pasos para reproducirlo <span className={styles.required}>*</span>
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
          className={styles.textarea}
        />
        <span className={styles.hint}>
          Entre más detallado, más rápido lo podremos arreglar.
        </span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <Button
        type="submit"
        disabled={submitting || !title.trim() || !steps.trim()}
        fullWidth
      >
        {submitting ? "Enviando..." : "Enviar reporte"}
      </Button>
    </form>
  );
}
