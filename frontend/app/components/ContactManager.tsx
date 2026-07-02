"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "./Button";
import PhoneCountrySelect from "./PhoneCountrySelect";
import { useAuth } from "../context/auth";
import { API_URL } from "@/app/lib/api";
import { apiErrorText } from "@/app/lib/apiError";
import { COUNTRIES } from "../lib/countries";
import styles from "./MenuPanel.module.css";

type ContactState = {
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
};

export default function ContactManager() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [state, setState] = useState<ContactState | null>(null);

  // Inputs para AÑADIR
  const [emailInput, setEmailInput] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("MX");
  const [phoneInput, setPhoneInput] = useState("");

  // Estados de verificación en curso: qué canal está pidiendo código
  const [verifying, setVerifying] = useState<"email" | "phone" | null>(null);
  const [codeInput, setCodeInput] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Carga el estado de contacto desde /auth/me
  const loadState = async () => {
    try {
      const res = await fetch(API_URL + "/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setState({
        email: data.email ?? null,
        phone: data.phone ?? null,
        emailVerified: !!data.emailVerified,
        phoneVerified: !!data.phoneVerified,
      });
    } catch {
      /* silencioso */
    }
  };

  useEffect(() => {
    if (token) loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetMessages = () => {
    setError("");
    setNotice("");
  };

  // --- AÑADIR EMAIL ---
  const addEmail = async () => {
    resetMessages();
    setBusy(true);
    try {
      const res = await fetch(API_URL + "/users/me/email", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          apiErrorText(
            data,
            t,
            t("menu.contact.addError", {
              defaultValue: "No se pudo añadir.",
            }),
          ),
        );
      }
      setEmailInput("");
      await loadState();
      setNotice(
        t("menu.contact.addedEmail", {
          defaultValue: "Correo añadido. Puedes verificarlo ahora.",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  // --- AÑADIR TELÉFONO ---
  const addPhone = async () => {
    resetMessages();
    setBusy(true);
    try {
      const dialCode =
        COUNTRIES.find((c) => c.code === phoneCountry)?.dialCode ?? "";
      const fullPhone = `${dialCode}${phoneInput.replace(/\D/g, "")}`;
      const res = await fetch(API_URL + "/users/me/phone", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          apiErrorText(
            data,
            t,
            t("menu.contact.addError", { defaultValue: "No se pudo añadir." }),
          ),
        );
      }
      setPhoneInput("");
      await loadState();
      setNotice(
        t("menu.contact.addedPhone", {
          defaultValue: "Teléfono añadido. Puedes verificarlo ahora.",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  // --- INICIAR VERIFICACIÓN ---
  const startVerify = async (channel: "email" | "phone") => {
    resetMessages();
    setBusy(true);
    try {
      const res = await fetch(API_URL + `/users/me/${channel}/verify/start`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          apiErrorText(
            data,
            t,
            t("menu.contact.verifyError", {
              defaultValue: "No se pudo enviar el código.",
            }),
          ),
        );
      }
      setVerifying(channel);
      setCodeInput("");
      setNotice(
        channel === "email"
          ? t("menu.contact.codeSentEmail", {
              defaultValue: "Te enviamos un enlace/código a tu correo.",
            })
          : t("menu.contact.codeSentPhone", {
              defaultValue: "Te enviamos un código por SMS.",
            }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  // --- CONFIRMAR VERIFICACIÓN ---
  const confirmVerify = async () => {
    if (!verifying) return;
    resetMessages();
    setBusy(true);
    try {
      const res = await fetch(
        API_URL + `/users/me/${verifying}/verify/confirm`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ code: codeInput.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          apiErrorText(
            data,
            t,
            t("menu.contact.confirmError", {
              defaultValue: "Código inválido.",
            }),
          ),
        );
      }
      setVerifying(null);
      setCodeInput("");
      await loadState();
      setNotice(
        t("menu.contact.verified", {
          defaultValue: "¡Verificado con éxito!",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        width: "100%",
        borderTop: "var(--border-thin) solid var(--color-border)",
        paddingTop: "var(--space-3)",
        marginTop: "var(--space-2)",
      }}
    >
      <label className={styles.editLabel}>
        {t("menu.contact.title", { defaultValue: "Métodos de contacto" })}
      </label>

      {/* ---------- EMAIL ---------- */}
      {state.email ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-2)",
            fontSize: "var(--text-sm)",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {state.email}
          </span>
          {state.emailVerified ? (
            <span
              style={{ color: "var(--color-success)", whiteSpace: "nowrap" }}
            >
              ✓ {t("menu.contact.verifiedTag", { defaultValue: "Verificado" })}
            </span>
          ) : (
            <Button
              variant="secondary"
              onClick={() => startVerify("email")}
              disabled={busy}
            >
              {t("menu.contact.verify", { defaultValue: "Verificar" })}
            </Button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <input
            type="email"
            placeholder={t("auth.emailPlaceholder", {
              defaultValue: "tucorreo@ejemplo.com",
            })}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className={styles.editInput}
          />
          <Button
            variant="secondary"
            onClick={addEmail}
            disabled={busy || !emailInput.trim()}
          >
            {t("menu.contact.addEmail", { defaultValue: "Añadir correo" })}
          </Button>
        </div>
      )}

      {/* ---------- TELÉFONO ---------- */}
      {state.phone ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-2)",
            fontSize: "var(--text-sm)",
          }}
        >
          <span>{state.phone}</span>
          {state.phoneVerified ? (
            <span
              style={{ color: "var(--color-success)", whiteSpace: "nowrap" }}
            >
              ✓ {t("menu.contact.verifiedTag", { defaultValue: "Verificado" })}
            </span>
          ) : (
            <Button
              variant="secondary"
              onClick={() => startVerify("phone")}
              disabled={busy}
            >
              {t("menu.contact.verify", { defaultValue: "Verificar" })}
            </Button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <PhoneCountrySelect
              value={phoneCountry}
              onChange={setPhoneCountry}
            />
            <input
              type="tel"
              placeholder="55 1234 5678"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className={styles.editInput}
              style={{ flex: 1 }}
            />
          </div>
          <Button
            variant="secondary"
            onClick={addPhone}
            disabled={busy || !phoneInput.trim()}
          >
            {t("menu.contact.addPhone", { defaultValue: "Añadir teléfono" })}
          </Button>
        </div>
      )}

      {/* ---------- CAMPO DE CÓDIGO (cuando se está verificando) ---------- */}
      {verifying && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            background: "var(--color-elevated)",
            padding: "var(--space-2)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <label className={styles.editLabel}>
            {t("menu.contact.enterCode", {
              defaultValue: "Ingresa el código",
            })}
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className={styles.editInput}
          />
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button
              variant="primary"
              onClick={confirmVerify}
              disabled={busy || !codeInput.trim()}
            >
              {t("menu.contact.confirm", { defaultValue: "Confirmar" })}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setVerifying(null)}
              disabled={busy}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
      {notice && (
        <p
          style={{
            color: "var(--color-success)",
            fontSize: "var(--text-xs)",
            margin: 0,
          }}
        >
          {notice}
        </p>
      )}
    </div>
  );
}
