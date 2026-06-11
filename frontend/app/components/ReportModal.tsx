"use client";

import { useState } from "react";
import { useAuth } from "../context/auth";
import { API_URL } from "@/app/lib/api";

type ReportType = "USER" | "PUBLICATION" | "COMMENT" | "CANVAS";

const REASONS: Record<ReportType, string[]> = {
  USER: [
    "Contenido explícito / NSFW",
    "Acoso",
    "Spam",
    "Discurso de odio",
    "Suplantación de identidad",
    "Otro",
  ],
  PUBLICATION: [
    "Contenido explícito / NSFW",
    "Spam",
    "Discurso de odio",
    "Otro",
  ],
  COMMENT: ["Acoso", "Spam", "Discurso de odio", "Contenido explícito", "Otro"],
  CANVAS: [
    "Contenido explícito / NSFW",
    "Discurso de odio",
    "Símbolo o contenido ofensivo",
    "Spam",
    "Otro",
  ],
};

const TITLES: Record<ReportType, string> = {
  USER: "Reportar usuario",
  PUBLICATION: "Reportar publicación",
  COMMENT: "Reportar comentario",
  CANVAS: "Reportar zona del lienzo",
};

export default function ReportModal({
  type,
  targetNickname,
  publicationId,
  commentId,
  x1,
  y1,
  x2,
  y2,
  onClose,
}: {
  type: ReportType;
  targetNickname?: string;
  publicationId?: number;
  commentId?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [reason, setReason] = useState(REASONS[type][0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(API_URL + "/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          targetNickname,
          publicationId,
          commentId,
          x1,
          y1,
          x2,
          y2,
          reason,
          details: details || undefined,
        }),
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

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          color: "#000",
          padding: "20px",
          borderRadius: "8px",
          width: "320px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {done ? (
          <>
            <h3 style={{ margin: 0 }}>Reporte enviado</h3>
            <p style={{ fontSize: "14px" }}>
              Gracias. Nuestro equipo lo revisará.
            </p>
            <button
              onClick={onClose}
              style={{ padding: "8px 12px", cursor: "pointer" }}
            >
              Cerrar
            </button>
          </>
        ) : (
          <>
            <h3 style={{ margin: 0 }}>{TITLES[type]}</h3>
            <label style={{ fontSize: "13px" }}>Motivo</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                padding: "8px",
                fontSize: "14px",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {REASONS[type].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <label style={{ fontSize: "13px" }}>Detalles (opcional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Información adicional..."
              style={{
                padding: "8px",
                fontSize: "14px",
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
            {error && (
              <p style={{ color: "red", fontSize: "13px", margin: 0 }}>
                {error}
              </p>
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button
                onClick={onClose}
                style={{ padding: "8px 12px", cursor: "pointer", flex: 1 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  flex: 1,
                  background: "#c33",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                }}
              >
                {submitting ? "Enviando..." : "Reportar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
