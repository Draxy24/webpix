"use client";

import { useEffect, useState } from "react";
import { COUNTRIES } from "../lib/countries";
import Flag from "./Flag";
import styles from "./RankingsView.module.css";

interface RankingEntry {
  nickname: string;
  profilePic: string | null;
  country: string | null;
  count: number;
}

export default function RankingsView() {
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

  return (
    <div className={styles.container}>
      <div className={styles.toggleGroup}>
        <button
          onClick={() => setMetric("pixels")}
          className={`${styles.toggle} ${metric === "pixels" ? styles.toggleActive : ""}`}
        >
          Píxeles
        </button>
        <button
          onClick={() => setMetric("creators")}
          className={`${styles.toggle} ${metric === "creators" ? styles.toggleActive : ""}`}
        >
          Creadores
        </button>
      </div>

      <div className={styles.toggleGroup}>
        <button
          onClick={() => setScope("global")}
          className={`${styles.toggle} ${scope === "global" ? styles.toggleActive : ""}`}
        >
          Global
        </button>
        <button
          onClick={() => setScope("national")}
          className={`${styles.toggle} ${scope === "national" ? styles.toggleActive : ""}`}
        >
          Nacional
        </button>
      </div>

      {scope === "national" && (
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className={styles.select}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {loading ? (
        <p className={styles.muted}>Cargando...</p>
      ) : entries.length === 0 ? (
        <p className={styles.muted}>No hay datos para este ranking todavía.</p>
      ) : (
        <div className={styles.list}>
          {entries.map((entry, index) => (
            <div key={entry.nickname} className={styles.entry}>
              <span
                className={`${styles.rank} ${index < 3 ? styles.rankTop : ""}`}
              >
                {index + 1}
              </span>
              <div
                className={styles.avatar}
                style={
                  entry.profilePic
                    ? { backgroundImage: `url(${entry.profilePic})` }
                    : undefined
                }
              />
              <a
                href={`/profile/${entry.nickname}`}
                className={styles.nameLink}
              >
                {entry.country && <Flag code={entry.country} />}
                <span className={styles.nameText}>{entry.nickname}</span>
              </a>
              <span className={styles.count}>{entry.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
