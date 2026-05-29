"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";
import { COUNTRIES } from "../lib/countries";
import PhoneCountrySelect from "./PhoneCountrySelect";
import Button from "./Button";
import styles from "./AuthForm.module.css";

export default function RegisterForm({
  switchToLogin,
}: {
  switchToLogin?: () => void;
}) {
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
      const res = await fetch("http://localhost:3001/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error al registrarse");
      login(data.token, data.nickname);
      router.push("/verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        type="text"
        placeholder="Nickname"
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
          Email
        </button>
        <button
          type="button"
          onClick={() => setMethod("phone")}
          className={`${styles.methodTab} ${method === "phone" ? styles.methodTabActive : ""}`}
        >
          Teléfono
        </button>
      </div>
      {method === "email" ? (
        <input
          type="email"
          placeholder="correo@ejemplo.com"
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
        placeholder="Contraseña"
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
        <option value="">País (opcional)</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" disabled={loading} fullWidth size="lg">
        {loading ? "Registrando..." : "Crear cuenta"}
      </Button>
      <div className={styles.footerLinks}>
        <p>
          ¿Ya tienes cuenta?{" "}
          {switchToLogin ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={switchToLogin}
            >
              Inicia sesión
            </button>
          ) : (
            <a href="/login">Inicia sesión</a>
          )}
        </p>
      </div>
    </form>
  );
}
