"use client";

import { useTranslation } from "react-i18next";

export default function AnonRegisterModal({
  onClose,
  onRegister,
}: {
  onClose: () => void;
  onRegister: () => void;
}) {
  const { t } = useTranslation();

  const perks = [
    t("canvas.anonPrompt.perkTools", {
      defaultValue:
        "Todas las herramientas: borrador, publicar, espacios privados y reportes",
    }),
    t("canvas.anonPrompt.perkProgress", {
      defaultValue: "Tu progreso: XP, niveles y Bits",
    }),
    t("canvas.anonPrompt.perkCosmetics", {
      defaultValue: "Cosméticos, tienda, logros y tareas semanales",
    }),
    t("canvas.anonPrompt.perkSocial", { defaultValue: "Amigos y rankings" }),
    t("canvas.anonPrompt.perkOg", {
      defaultValue: "El título OG, con cupo limitado",
    }),
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "var(--space-4)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          border: "var(--border-normal) solid var(--color-border-strong)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-6)",
          maxWidth: "420px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          color: "var(--color-text)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            color: "var(--color-brand)",
            margin: 0,
            marginBottom: "var(--space-2)",
          }}
        >
          {t("canvas.anonPrompt.title", { defaultValue: "Llegaste al límite" })}
        </h2>
        <p
          style={{
            color: "var(--color-text-secondary)",
            marginTop: 0,
            marginBottom: "var(--space-4)",
          }}
        >
          {t("canvas.anonPrompt.subtitle", {
            defaultValue: "Crea tu cuenta gratis y desbloquea todo:",
          })}
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            marginBottom: "var(--space-6)",
          }}
        >
          {perks.map((perk, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                gap: "var(--space-2)",
                marginBottom: "var(--space-2)",
                fontSize: "var(--text-sm)",
              }}
            >
              <span
                style={{
                  color: "var(--color-brand)",
                  fontWeight: "var(--weight-bold)",
                }}
              >
                ✓
              </span>
              <span>{perk}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={onRegister}
          style={{
            width: "100%",
            background: "var(--color-brand)",
            color: "var(--color-bg)",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3)",
            fontWeight: "var(--weight-bold)",
            fontSize: "var(--text-sm)",
            cursor: "pointer",
            marginBottom: "var(--space-2)",
          }}
        >
          {t("canvas.anonPrompt.cta", { defaultValue: "Crear cuenta" })}
        </button>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            background: "transparent",
            color: "var(--color-text-muted)",
            border: "none",
            padding: "var(--space-2)",
            fontSize: "var(--text-sm)",
            cursor: "pointer",
          }}
        >
          {t("canvas.anonPrompt.later", { defaultValue: "Ahora no" })}
        </button>
      </div>
    </div>
  );
}
