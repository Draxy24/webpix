"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import Button from "./Button";
import styles from "./AuthForm.module.css";
import { API_URL } from "@/app/lib/api";

export default function LoginForm({
  onSuccess,
  switchToRegister,
  onForgotPassword,
}: {
  onSuccess?: () => void;
  switchToRegister?: () => void;
  onForgotPassword?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [banInfo, setBanInfo] = useState<{
    banReason: string | null;
    bannedUntil: string | null;
    banPermanent: boolean;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBanInfo(null);
    setLoading(true);
    try {
      const res = await fetch(API_URL + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.banned) {
          setBanInfo({
            banReason: data.banReason,
            bannedUntil: data.bannedUntil,
            banPermanent: data.banPermanent,
          });
          return;
        }
        throw new Error(data.message ?? t("auth.login.error"));
      }
      login(data.token, data.nickname);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        type="text"
        placeholder={t("auth.login.emailOrPhone")}
        value={emailOrPhone}
        onChange={(e) => setEmailOrPhone(e.target.value)}
        required
        className={styles.input}
      />
      <input
        type="password"
        placeholder={t("auth.password")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className={styles.input}
      />
      {banInfo && (
        <div className={styles.banBox}>
          <div className={styles.banTitle}>🚫 {t("auth.ban.title")}</div>
          <div>
            <strong>{t("auth.ban.reason")}</strong>{" "}
            {banInfo.banReason ?? t("auth.ban.reasonUnknown")}
          </div>
          <div>
            <strong>{t("auth.ban.duration")}</strong>{" "}
            {banInfo.banPermanent
              ? t("auth.ban.permanent")
              : banInfo.bannedUntil
                ? t("auth.ban.until", {
                    date: new Date(banInfo.bannedUntil).toLocaleString(
                      i18n.language,
                    ),
                  })
                : t("auth.ban.durationUnknown")}
          </div>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" disabled={loading} fullWidth size="lg">
        {loading ? t("auth.login.submitting") : t("auth.login.submit")}
      </Button>
      <div className={styles.footerLinks}>
        <p>
          {t("auth.login.noAccount")}{" "}
          {switchToRegister ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={switchToRegister}
            >
              {t("auth.login.register")}
            </button>
          ) : (
            <a href="/register">{t("auth.login.register")}</a>
          )}
        </p>
        <p>
          {onForgotPassword ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={onForgotPassword}
            >
              {t("auth.login.forgot")}
            </button>
          ) : (
            <a href="/forgot-password">{t("auth.login.forgot")}</a>
          )}
        </p>
      </div>
    </form>
  );
}
