"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";
import { COUNTRIES } from "../lib/countries";
import PhoneCountrySelect from "../components/PhoneCountrySelect";

export default function RegisterPage() {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "80px",
      }}
    >
      <h1>Crear cuenta</h1>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          width: "300px",
        }}
      >
        <input
          type="text"
          placeholder="Nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          style={{ padding: "8px", fontSize: "14px" }}
        />
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setMethod("email")}
            style={{
              flex: 1,
              padding: "8px",
              cursor: "pointer",
              background: method === "email" ? "#000" : "#fff",
              color: method === "email" ? "#fff" : "#000",
              border: "1px solid #000",
            }}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setMethod("phone")}
            style={{
              flex: 1,
              padding: "8px",
              cursor: "pointer",
              background: method === "phone" ? "#000" : "#fff",
              color: method === "phone" ? "#fff" : "#000",
              border: "1px solid #000",
            }}
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
            style={{ padding: "8px", fontSize: "14px" }}
          />
        ) : (
          <div style={{ display: "flex", gap: "6px" }}>
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
              style={{ padding: "8px", fontSize: "14px", flex: 1 }}
            />
          </div>
        )}

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: "8px", fontSize: "14px" }}
        />
        {error && <p style={{ color: "red", fontSize: "13px" }}>{error}</p>}
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          style={{ padding: "8px", fontSize: "14px" }}
        >
          <option value="">País (opcional)</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px", cursor: "pointer" }}
        >
          {loading ? "Registrando..." : "Crear cuenta"}
        </button>
        <p style={{ textAlign: "center", fontSize: "13px" }}>
          ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
        </p>
      </form>
    </main>
  );
}
