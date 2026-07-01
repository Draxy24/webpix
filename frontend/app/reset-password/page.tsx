"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import Button from "../components/Button";
import PhoneCountrySelect from "../components/PhoneCountrySelect";
import styles from "../components/AuthForm.module.css";
import { API_URL } from "@/app/lib/api";
import { apiErrorText } from "@/app/lib/apiError";
import { COUNTRIES } from "../lib/countries";

function ResetPasswordInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Si viene de un enlace de correo, trae emailOrPhone + code en la URL.
  const prefill = searchParams.get("emailOrPhone") ?? "";
  const fromLink = prefill.length > 0;

  // Si el prefill parece teléfono (empieza con +), arrancamos en modo phone.
  const [method, setMethod] = useState<"email" | "phone">(
    prefill.startsWith("+") ? "phone" : "email",
  );
  const [email, setEmail] = useState(prefill.startsWith("+") ? "" : prefill);
  const [phoneCountry, setPhoneCountry] = useState("MX");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let emailOrPhone: string;
      if (method === "email") {
        emailOrPhone = email;
      } else {
        const dialCode =
          COUNTRIES.find((c) => c.code === phoneCountry)?.dialCode ?? "";
        emailOrPhone = `${dialCode}${phoneNumber.replace(/\s/g, "")}`;
      }
      const res = await fetch(API_URL + "/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, code, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(apiErrorText(data, t, t("resetPassword.error")));
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("resetPassword.error"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthPageLayout title={t("resetPassword.successTitle")}>
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
            {t("resetPassword.successText")}
          </p>
          <Button fullWidth size="lg" onClick={() => router.push("/login")}>
            {t("resetPassword.login")}
          </Button>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title={t("resetPassword.title")}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Si viene de un enlace de correo, no mostramos el toggle: ya sabemos el destino */}
        {!fromLink && (
          <>
            <div className={styles.methodTabs}>
              <button
                type="button"
                onClick={() => setMethod("email")}
                className={`${styles.methodTab} ${method === "email" ? styles.methodTabActive : ""}`}
              >
                {t("auth.email")}
              </button>
              <button
                type="button"
                onClick={() => setMethod("phone")}
                className={`${styles.methodTab} ${method === "phone" ? styles.methodTabActive : ""}`}
              >
                {t("auth.phone")}
              </button>
            </div>

            {method === "email" ? (
              <input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={styles.input}
              />
            ) : (
              <div className={styles.phoneRow}>
                <PhoneCountrySelect
                  value={phoneCountry}
                  onChange={setPhoneCountry}
                />
                <input
                  type="tel"
                  placeholder="476 124 5532"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  className={styles.input}
                  style={{ flex: 1 }}
                />
              </div>
            )}
          </>
        )}

        {/* Si viene del enlace de correo, mostramos a quién va (solo lectura) */}
        {fromLink && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              margin: 0,
            }}
          >
            {t("resetPassword.forAccount", {
              defaultValue: "Restableciendo la contraseña de {{account}}",
              account: prefill,
            })}
          </p>
        )}

        <input
          type="text"
          inputMode="numeric"
          placeholder={t("resetPassword.code")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          className={styles.input}
        />
        <input
          type="password"
          placeholder={t("resetPassword.newPassword")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className={styles.input}
        />
        {error && <p className={styles.error}>{error}</p>}
        <Button type="submit" disabled={loading} fullWidth size="lg">
          {loading ? t("resetPassword.saving") : t("resetPassword.submit")}
        </Button>
      </form>
    </AuthPageLayout>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <AuthPageLayout title={t("common.loading")}>
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
      <ResetPasswordInner />
    </Suspense>
  );
}
