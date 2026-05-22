"use client";

import { useEffect, useState } from "react";
import { COUNTRIES } from "../lib/countries";
import Flag from "../components/Flag";

interface RankingEntry {
  nickname: string;
  profilePic: string | null;
  country: string | null;
  count: number;
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    cursor: "pointer",
    background: active ? "#000" : "#fff",
    color: active ? "#fff" : "#000",
    border: "1px solid #000",
  };
}

export default function RankingsPage() {
  const [metric, setMetric] = useState<"pixels" | "creators">("pixels");
  const [scope, setScope] = useState<"global" | "national">("global");
  const [country, setCountry] = useState("MX");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      const url =
        scope === "global"
          ? `http://localhost:3001/rankings/${metric}/global`
          : `http://localhost:3001/rankings/${metric}/national/${country}`;
      const res = await fetch(url);
      const data = await res.json();
      setEntries(data);
      setLoading(false);
    };
    fetchRanking();
  }, [metric, scope, country]);

  const metricLabel = metric === "pixels" ? "píxeles" : "obras";

  return (
    <main style={{ maxWidth: "600px", margin: "40px auto", padding: "20px" }}>
      <h1>Rankings</h1>

      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <button
          onClick={() => setMetric("pixels")}
          style={tabStyle(metric === "pixels")}
        >
          Píxeles pintados
        </button>
        <button
          onClick={() => setMetric("creators")}
          style={tabStyle(metric === "creators")}
        >
          Creadores
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => setScope("global")}
          style={tabStyle(scope === "global")}
        >
          Global
        </button>
        <button
          onClick={() => setScope("national")}
          style={tabStyle(scope === "national")}
        >
          Nacional
        </button>
        {scope === "national" && (
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{ padding: "6px" }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "#aaa" }}>No hay datos para este ranking todavía.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {entries.map((entry, index) => (
            <div
              key={entry.nickname}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                border: "1px solid #555",
                borderRadius: "8px",
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  width: "28px",
                  textAlign: "center",
                }}
              >
                {index + 1}
              </span>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#eee",
                  backgroundImage: entry.profilePic
                    ? `url(${entry.profilePic})`
                    : "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  flexShrink: 0,
                }}
              />
              <a href={`/profile/${entry.nickname}`} style={{ flex: 1 }}>
                {entry.country && <Flag code={entry.country} />}
                {entry.nickname}
              </a>
              <span style={{ color: "#aaa" }}>
                {entry.count} {metricLabel}
              </span>
            </div>
          ))}
        </div>
      )}

      <a
        href="/"
        style={{ display: "block", marginTop: "20px", fontSize: "13px" }}
      >
        ← Volver al lienzo
      </a>
    </main>
  );
}
