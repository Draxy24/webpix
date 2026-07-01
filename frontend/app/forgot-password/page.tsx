"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import Button from "../components/Button";
import PhoneCountrySelect from "../components/PhoneCountrySelect";
import styles from "../components/AuthForm.module.css";
import { API_URL } from "@/app/lib/api";
import { COUNTRIES } from "../lib/countries";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("MX");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let emailOrPhone: string;
    if (method === "email") {
      emailOrPhone = email;
    } else {
      const dialCode =
        COUNTRIES.find((c) => c.code === phoneCountry)?.dialCode ?? "";
      emailOrPhone = `${dialCode}${phoneNumber.replace(/\s/g, "")}`;
    }

    await fetch(API_URL + "/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrPhone }),
    });
    setSubmitted(true);
    setLoading(false);
  };

  // Llevamos el destino al reset para prefill (y para que arranque en el modo correcto)
  const goToReset = () => {
    if (method === "email") {
      router.push(
        `/reset-password?emailOrPhone=${encodeURIComponent(email.trim())}`,
      );
    } else {
      router.push("/reset-password"); // el teléfono se re-arma en reset, sin URL
    }
  };

  return (
    <AuthPageLayout title={t("forgotPassword.title")}>
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
            {t("forgotPassword.sentText")}
          </p>
          <Button variant="secondary" fullWidth onClick={goToReset}>
            {t("forgotPassword.haveCode")}
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
            {t("forgotPassword.intro")}
          </p>

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

          <Button type="submit" disabled={loading} fullWidth size="lg">
            {loading ? t("forgotPassword.sending") : t("forgotPassword.submit")}
          </Button>
          <p
            style={{
              textAlign: "center",
              fontSize: "var(--text-sm)",
              margin: 0,
            }}
          >
            <a href="/login" style={{ color: "var(--color-brand)" }}>
              {t("forgotPassword.backToLogin")}
            </a>
          </p>
        </form>
      )}
    </AuthPageLayout>
  );
}
