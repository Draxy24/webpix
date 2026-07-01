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

  const prefill = searchParams.get("emailOrPhone") ?? "";
  // El prefill solo lo confiamos para email. Si parece teléfono (trae + o %2B
  // decodificado), NO lo usamos como valor: mostramos el selector y lo rearmamos.
  const prefillIsPhone = prefill.startsWith("+") || prefill.includes(" ");

  const [method, setMethod] = useState<"email" | "phone">(
    prefillIsPhone ? "phone" : "email",
  );
  const [email, setEmail] = useState(prefillIsPhone ? "" : prefill);
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
        emailOrPhone = email.trim();
      } else {
        const dialCode =
          COUNTRIES.find((c) => c.code === phoneCountry)?.dialCode ?? "";
        emailOrPhone = `${dialCode}${phoneNumber.replace(/\D/g, "")}`;
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
        {/* Para email que vino por enlace, mostramos a quién va (solo lectura).
            Para teléfono SIEMPRE mostramos el selector: el + no sobrevive la URL. */}
        {method === "email" && !prefillIsPhone && prefill ? (
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
        ) : (
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
                  placeholder="55 1234 5678"
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
