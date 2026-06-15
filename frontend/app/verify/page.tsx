"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import AuthPageLayout from "../components/AuthPageLayout";
import Button from "../components/Button";
import styles from "../components/AuthForm.module.css";
import { API_URL } from "@/app/lib/api";
import { apiErrorText } from "@/app/lib/apiError";

export default function VerifyPage() {
  const { t } = useTranslation();
  const { token, loading } = useAuth();
  const router = useRouter();

  const [method, setMethod] = useState<"email" | "phone" | null>(null);
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!token) return;
    const res = await fetch(API_URL + "/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.verified) {
      router.push("/");
      return;
    }
    setMethod(data.needsVerification);
    setChecking(false);
  }, [token, router]);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    checkStatus();
  }, [token, loading, router, checkStatus]);

  const handleVerifyPhone = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(API_URL + "/auth/verify-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          apiErrorText(data, t, t("verify.phone.invalidCode")),
        );
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("verify.phone.invalidCode"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setInfo("");
    const res = await fetch(API_URL + "/auth/resend-verification", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setInfo(t("verify.resent"));
  };

  if (loading || checking) {
    return (
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
    );
  }

  return (
    <AuthPageLayout title={t("verify.accountTitle")}>
      {method === "email" && (
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
            {t("verify.email.body")}
          </p>
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              textAlign: "center",
              margin: 0,
            }}
          >
            {t("verify.email.note")}
          </p>
          <Button variant="secondary" fullWidth onClick={handleResend}>
            {t("verify.email.resend")}
          </Button>
          {info && (
            <p
              style={{
                color: "var(--color-success)",
                fontSize: "var(--text-xs)",
                textAlign: "center",
                margin: 0,
              }}
            >
              {info}
            </p>
          )}
        </div>
      )}

      {method === "phone" && (
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
            {t("verify.phone.body")}
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={styles.input}
            style={{
              textAlign: "center",
              fontSize: "var(--text-lg)",
              letterSpacing: "4px",
            }}
          />
          {error && <p className={styles.error}>{error}</p>}
          <Button
            fullWidth
            size="lg"
            onClick={handleVerifyPhone}
            disabled={submitting || code.length !== 6}
          >
            {submitting
              ? t("verify.phone.verifying")
              : t("verify.phone.verify")}
          </Button>
          <Button variant="ghost" fullWidth onClick={handleResend}>
            {t("verify.phone.resend")}
          </Button>
          {info && (
            <p
              style={{
                color: "var(--color-success)",
                fontSize: "var(--text-xs)",
                textAlign: "center",
                margin: 0,
              }}
            >
              {info}
            </p>
          )}
        </div>
      )}
    </AuthPageLayout>
  );
}
