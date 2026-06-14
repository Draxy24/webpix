"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import PhoneCountrySelect from "./PhoneCountrySelect";
import Button from "./Button";
import styles from "./AuthForm.module.css";
import { API_URL } from "@/app/lib/api";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
      if (!res.ok) throw new Error(data.message ?? t("auth.register.error"));
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
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" disabled={loading} fullWidth size="lg">
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
