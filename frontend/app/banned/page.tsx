"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";

export default function BannedPage() {
  const { token, loading, logout } = useAuth();
  const router = useRouter();
  const [info, setInfo] = useState<{
    banReason: string | null;
    bannedUntil: string | null;
    banPermanent: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    fetch("http://localhost:3001/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.banned) {
          router.push("/");
          return;
        }
        setInfo({
          banReason: data.banReason,
          bannedUntil: data.bannedUntil,
          banPermanent: data.banPermanent,
        });
        setChecking(false);
      });
  }, [token, loading, router]);

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
        maxWidth: "480px",
        margin: "80px auto",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "48px" }}>🚫</div>
      <h1 style={{ color: "#c33" }}>Cuenta suspendida</h1>
      <p style={{ fontSize: "15px" }}>
        Tu cuenta ha sido suspendida por incumplir las normas de la comunidad.
      </p>

      <div
        style={{
          background: "#2a1a1a",
          border: "1px solid #c33",
          borderRadius: "8px",
          padding: "16px",
          margin: "20px 0",
          textAlign: "left",
        }}
      >
        <div style={{ marginBottom: "8px" }}>
          <strong>Motivo:</strong> {info?.banReason ?? "No especificado"}
        </div>
        <div>
          <strong>Duración:</strong>{" "}
          {info?.banPermanent
            ? "Permanente"
            : info?.bannedUntil
              ? `Hasta el ${new Date(info.bannedUntil).toLocaleString("es-MX")}`
              : "No especificada"}
        </div>
      </div>

      <p style={{ fontSize: "13px", color: "#aaa" }}>
        Si crees que esto es un error, puedes contactar al equipo de soporte.
      </p>

      <button
        onClick={() => {
          logout();
          router.push("/login");
        }}
        style={{ padding: "10px 20px", cursor: "pointer", marginTop: "12px" }}
      >
        Cerrar sesión
      </button>
    </main>
  );
}
