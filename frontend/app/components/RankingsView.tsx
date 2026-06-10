"use client";

import { useEffect, useState } from "react";
import { COUNTRIES } from "../lib/countries";
import Flag from "./Flag";
import styles from "./RankingsView.module.css";
import { API_URL } from "@/app/lib/api";

interface RankingEntry {
  nickname: string;
  profilePic: string | null;
  country: string | null;
  count: number;
}

interface Winner {
  metric: string;
  scope: string;
  country: string | null;
  position: number;
  score: number;
  bitsAwarded: number;
  nickname: string;
  profilePic: string | null;
  userCountry: string | null;
}

type View = "monthly" | "historical" | "winners";

function formatCountdown(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "cerrando...";
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function periodLabel(period: string): string {
  const [y, mo] = period.split("-");
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${months[parseInt(mo, 10) - 1] ?? mo} ${y}`;
}

export default function RankingsView({
  onOpenProfile,
}: {
  onOpenProfile?: (nickname: string) => void;
}) {
  const [view, setView] = useState<View>("monthly");
  const [metric, setMetric] = useState<"pixels" | "creators">("pixels");
  const [scope, setScope] = useState<"global" | "national">("global");
  const [country, setCountry] = useState("MX");

  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [info, setInfo] = useState<{ period: string; endsAt: string } | null>(
    null,
  );
  const [, setTick] = useState(0);

  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [winners, setWinners] = useState<Winner[]>([]);

  // Ranking mensual o histórico
  useEffect(() => {
    if (view === "winners") return;
    const fetchRanking = async () => {
      setLoading(true);
      const base =
        view === "monthly"
          ? `${API_URL}/rankings/monthly`
          : `${API_URL}/rankings`;
      const url =
        scope === "global"
          ? `${base}/${metric}/global`
          : `${base}/${metric}/national/${country}`;
      try {
        const res = await fetch(url);
        setEntries(await res.json());
      } catch {
        setEntries([]);
      }
      setLoading(false);
    };
    fetchRanking();
  }, [view, metric, scope, country]);

  // Info del mes (cuenta regresiva)
  useEffect(() => {
    if (view !== "monthly") return;
    fetch(`${API_URL}/rankings/monthly/info`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [view]);

  // Periodos con ganadores
  useEffect(() => {
    if (view !== "winners") return;
    fetch(`${API_URL}/rankings/winners/periods`)
      .then((r) => r.json())
      .then((ps: string[]) => {
        setPeriods(ps);
        setPeriod((prev) => prev || ps[0] || "");
      })
      .catch(() => setPeriods([]));
  }, [view]);

  // Ganadores del periodo seleccionado
  useEffect(() => {
    if (view !== "winners" || !period) {
      setWinners([]);
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/rankings/winners/${period}`)
      .then((r) => r.json())
      .then((w: Winner[]) => setWinners(w))
      .catch(() => setWinners([]))
      .finally(() => setLoading(false));
  }, [view, period]);

  const metricKey = metric === "creators" ? "creations" : "pixels";
  const shownWinners = winners
    .filter(
      (w) =>
        w.metric === metricKey &&
        w.scope === scope &&
        (scope === "global" || w.country === country),
    )
    .sort((a, b) => a.position - b.position);

  return (
    <div className={styles.container}>
      {/* Periodo */}
      <div className={styles.toggleGroup}>
        <button
          onClick={() => setView("monthly")}
          className={`${styles.toggle} ${view === "monthly" ? styles.toggleActive : ""}`}
        >
          Este mes
        </button>
        <button
          onClick={() => setView("historical")}
          className={`${styles.toggle} ${view === "historical" ? styles.toggleActive : ""}`}
        >
          Histórico
        </button>
        <button
          onClick={() => setView("winners")}
          className={`${styles.toggle} ${view === "winners" ? styles.toggleActive : ""}`}
        >
          Ganadores
        </button>
      </div>

      {/* Cuenta regresiva (solo mensual) */}
      {view === "monthly" && info && (
        <div className={styles.countdown}>
          <span className={styles.countdownLabel}>Cierra en</span>
          <span className={styles.countdownTime}>
            {formatCountdown(info.endsAt)}
          </span>
          <span className={styles.countdownHint}>
            Top 10 recibe recompensas 🏆
          </span>
        </div>
      )}

      {/* Salón de la fama (solo ganadores) */}
      {view === "winners" && (
        <>
          <h3 className={styles.sectionTitle}>🏆 Salón de la Fama</h3>
          {periods.length > 0 && (
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={styles.select}
            >
              {periods.map((p) => (
                <option key={p} value={p}>
                  {periodLabel(p)}
                </option>
              ))}
            </select>
          )}
        </>
      )}

      {/* Métrica */}
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

      {/* Alcance */}
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

      {/* Lista */}
      {loading ? (
        <p className={styles.muted}>Cargando...</p>
      ) : view === "winners" ? (
        shownWinners.length === 0 ? (
          <p className={styles.muted}>
            {periods.length === 0
              ? "Aún no hay ganadores. Se registran al cerrar cada mes."
              : "No hay ganadores para esta categoría."}
          </p>
        ) : (
          <div className={styles.list}>
            {shownWinners.map((w) => (
              <div
                key={`${w.metric}-${w.scope}-${w.country}-${w.position}`}
                className={styles.entry}
              >
                <span
                  className={`${styles.rank} ${w.position <= 3 ? styles.rankTop : ""}`}
                >
                  {w.position}
                </span>
                <div
                  className={styles.avatar}
                  style={
                    w.profilePic
                      ? { backgroundImage: `url(${w.profilePic})` }
                      : undefined
                  }
                />
                <a
                  href={`/profile/${w.nickname}`}
                  className={styles.nameLink}
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    if (onOpenProfile) {
                      e.preventDefault();
                      onOpenProfile(w.nickname);
                    }
                  }}
                >
                  {w.userCountry && <Flag code={w.userCountry} />}
                  <span className={styles.nameText}>{w.nickname}</span>
                </a>
                {w.bitsAwarded > 0 && (
                  <span className={styles.bits}>+{w.bitsAwarded}</span>
                )}
              </div>
            ))}
          </div>
        )
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
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  if (onOpenProfile) {
                    e.preventDefault();
                    onOpenProfile(entry.nickname);
                  }
                }}
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
