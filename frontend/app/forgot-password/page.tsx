"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import Button from "../components/Button";
import styles from "../components/AuthForm.module.css";
import { API_URL } from "@/app/lib/api";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch(API_URL + "/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrPhone }),
    });
    setSubmitted(true);
    setLoading(false);
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
          <Button
            variant="secondary"
            fullWidth
            onClick={() => router.push("/reset-password")}
          >
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
          <input
            type="text"
            placeholder={t("forgotPassword.placeholder")}
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            required
            className={styles.input}
          />
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
