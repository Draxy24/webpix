"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import Button from "../components/Button";
import styles from "../components/AuthForm.module.css";
import { API_URL } from "@/app/lib/api";
import { apiErrorText } from "@/app/lib/apiError";

function ResetPasswordInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState(
    searchParams.get("emailOrPhone") ?? "",
  );
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
      const res = await fetch(API_URL + "/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, code, newPassword }),
      });
      const data = await res.json();
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
        <input
          type="text"
          placeholder={t("resetPassword.emailOrPhone")}
          value={emailOrPhone}
          onChange={(e) => setEmailOrPhone(e.target.value)}
          required
          className={styles.input}
        />
        <input
          type="text"
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
