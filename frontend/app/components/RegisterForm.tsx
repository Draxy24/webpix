"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import PhoneCountrySelect from "./PhoneCountrySelect";
import Button from "./Button";
import styles from "./AuthForm.module.css";
import { API_URL } from "@/app/lib/api";
import { apiErrorText } from "@/app/lib/apiError";
import { COUNTRIES } from "../lib/countries";
import { countryName } from "@/app/lib/countryName";

export default function RegisterForm({
  switchToLogin,
}: {
  switchToLogin?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("MX");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState("");
  const [accepted, setAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!accepted) {
      setError(
        t("auth.register.mustAccept", {
          defaultValue: "Debes aceptar los términos para continuar.",
        }),
      );
      return;
    }
    setLoading(true);
    try {
      let body;
      if (method === "email") {
        body = { nickname, email, password, country: country || undefined };
      } else {
        const dialCode =
          COUNTRIES.find((c) => c.code === phoneCountry)?.dialCode ?? "";
        const fullPhone = `${dialCode}${phoneNumber.replace(/\s/g, "")}`;
        body = {
          nickname,
          phone: fullPhone,
          password,
          country: country || undefined,
        };
      }
      const res = await fetch(API_URL + "/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(apiErrorText(data, t, t("auth.register.error")));
      login(data.token, data.nickname);
      router.push("/verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.register.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        type="text"
        placeholder={t("auth.nickname")}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        required
        className={styles.input}
      />
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
          <PhoneCountrySelect value={phoneCountry} onChange={setPhoneCountry} />
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
      <input
        type="password"
        placeholder={t("auth.password")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className={styles.input}
      />
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className={styles.input}
      >
        <option value="">{t("auth.countryOptional")}</option>
        {COUNTRIES.map((c) => ({
          code: c.code,
          label: countryName(c.code, i18n.language),
        }))
          .sort((a, b) => a.label.localeCompare(b.label, i18n.language))
          .map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
      </select>
      <label
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "flex-start",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-secondary)",
        }}
      >
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          required
        />
        <span>
          {t("auth.register.acceptPre", {
            defaultValue: "He leído y acepto los",
          })}{" "}
          <a
            href="/terminos"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-brand)" }}
          >
            {t("auth.register.termsLink", {
              defaultValue: "Términos de Servicio",
            })}
          </a>
          {", "}
          <a
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-brand)" }}
          >
            {t("auth.register.privacyLink", {
              defaultValue: "Política de Privacidad",
            })}
          </a>{" "}
          {t("auth.register.acceptAnd", { defaultValue: "y la" })}{" "}
          <a
            href="/reembolsos"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-brand)" }}
          >
            {t("auth.register.refundsLink", {
              defaultValue: "Política de Reembolsos",
            })}
          </a>
          .
        </span>
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" disabled={loading || !accepted} fullWidth size="lg">
        {loading ? t("auth.register.submitting") : t("auth.register.submit")}
      </Button>
      <div className={styles.footerLinks}>
        <p>
          {t("auth.register.haveAccount")}{" "}
          {switchToLogin ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={switchToLogin}
            >
              {t("auth.register.login")}
            </button>
          ) : (
            <a href="/login">{t("auth.register.login")}</a>
          )}
        </p>
      </div>
    </form>
  );
}
