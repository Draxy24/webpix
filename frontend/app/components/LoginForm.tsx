"use client";

import { useState } from "react";
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
        throw new Error(data.message ?? "Error al iniciar sesión");
      }
      login(data.token, data.nickname);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        type="text"
        placeholder="Email o teléfono"
        value={emailOrPhone}
        onChange={(e) => setEmailOrPhone(e.target.value)}
        required
        className={styles.input}
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className={styles.input}
      />
      {banInfo && (
        <div className={styles.banBox}>
          <div className={styles.banTitle}>🚫 Cuenta suspendida</div>
          <div>
            <strong>Motivo:</strong> {banInfo.banReason ?? "No especificado"}
          </div>
          <div>
            <strong>Duración:</strong>{" "}
            {banInfo.banPermanent
              ? "Permanente"
              : banInfo.bannedUntil
                ? `Hasta el ${new Date(banInfo.bannedUntil).toLocaleString("es-MX")}`
                : "No especificada"}
          </div>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" disabled={loading} fullWidth size="lg">
        {loading ? "Entrando..." : "Entrar"}
      </Button>
      <div className={styles.footerLinks}>
        <p>
          ¿No tienes cuenta?{" "}
          {switchToRegister ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={switchToRegister}
            >
              Regístrate
            </button>
          ) : (
            <a href="/register">Regístrate</a>
          )}
        </p>
        <p>
          {onForgotPassword ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={onForgotPassword}
            >
              ¿Olvidaste tu contraseña?
            </button>
          ) : (
            <a href="/forgot-password">¿Olvidaste tu contraseña?</a>
          )}
        </p>
      </div>
    </form>
  );
}
