"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/auth";
import styles from "./RewardsView.module.css";
import { badgeIcon } from "../lib/badges";

type Progression = {
  bits: number;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  currencyNamePlural: string;
  equippedTitle: { id: number; name: string } | null;
  equippedBadge: {
    id: number;
    name: string;
    data: { icon?: string } | null;
  } | null;
};

type Cosmetic = {
  cosmeticId: number;
  key: string;
  type: "TITLE" | "BADGE" | "FRAME" | "BACKGROUND";
  name: string;
  description: string | null;
  data: {
    icon?: string;
    color?: string;
    ring?: string;
    background?: string;
  } | null;
  equipped: boolean;
};

export default function RewardsView() {
  const { token } = useAuth();
  const [prog, setProg] = useState<Progression | null>(null);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const pRes = await fetch("http://localhost:3001/rewards/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProg(await pRes.json());
      const cRes = await fetch("http://localhost:3001/rewards/cosmetics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCosmetics(await cRes.json());
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (c: Cosmetic) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      const endpoint = c.equipped ? "unequip" : "equip";
      await fetch(`http://localhost:3001/rewards/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cosmeticId: c.cosmeticId }),
      });
      await load();
    } catch {
      // noop
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className={styles.muted}>Cargando recompensas...</p>;
  if (!prog) return null;

  const titles = cosmetics.filter((c) => c.type === "TITLE");
  const badges = cosmetics.filter((c) => c.type === "BADGE");
  const frames = cosmetics.filter((c) => c.type === "FRAME");
  const backgrounds = cosmetics.filter((c) => c.type === "BACKGROUND");
  const pct =
    prog.xpForNext > 0
      ? Math.min(100, Math.round((prog.xpIntoLevel / prog.xpForNext) * 100))
      : 100;

  return (
    <div className={styles.container}>
      <div className={styles.progCard}>
        <div className={styles.progTop}>
          <span className={styles.level}>
            Nivel {prog.level}
            {prog.equippedTitle ? ` · ${prog.equippedTitle.name}` : ""}
          </span>
          <span className={styles.bits}>
            {prog.bits} {prog.currencyNamePlural}
          </span>
        </div>
        <div className={styles.xpBar}>
          <div className={styles.xpFill} style={{ width: `${pct}%` }} />
        </div>
        <div className={styles.xpText}>
          {prog.xpForNext > 0
            ? `${prog.xpIntoLevel} / ${prog.xpForNext} XP`
            : "Nivel máximo"}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Títulos</h4>
        {titles.length === 0 ? (
          <p className={styles.muted}>Aún no tienes títulos.</p>
        ) : (
          <div className={styles.chips}>
            {titles.map((c) => (
              <button
                key={c.cosmeticId}
                className={`${styles.chip} ${c.equipped ? styles.chipActive : ""}`}
                onClick={() => toggle(c)}
                disabled={busy}
                title={c.description ?? undefined}
                style={
                  c.data?.color
                    ? { color: c.data.color, borderColor: c.data.color }
                    : undefined
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Insignias</h4>
        {badges.length === 0 ? (
          <p className={styles.muted}>Aún no tienes insignias.</p>
        ) : (
          <div className={styles.chips}>
            {badges.map((c) => (
              <button
                key={c.cosmeticId}
                className={`${styles.chip} ${c.equipped ? styles.chipActive : ""}`}
                onClick={() => toggle(c)}
                disabled={busy}
                title={c.description ?? undefined}
              >
                {badgeIcon(c.data?.icon)} {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Marcos</h4>
        {frames.length === 0 ? (
          <p className={styles.muted}>Aún no tienes marcos.</p>
        ) : (
          <div className={styles.chips}>
            {frames.map((c) => (
              <button
                key={c.cosmeticId}
                className={`${styles.chip} ${c.equipped ? styles.chipActive : ""}`}
                onClick={() => toggle(c)}
                disabled={busy}
                title={c.description ?? undefined}
              >
                <span
                  className={styles.ringSwatch}
                  style={c.data?.ring ? { background: c.data.ring } : undefined}
                />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Fondos</h4>
        {backgrounds.length === 0 ? (
          <p className={styles.muted}>Aún no tienes fondos.</p>
        ) : (
          <div className={styles.chips}>
            {backgrounds.map((c) => (
              <button
                key={c.cosmeticId}
                className={`${styles.chip} ${c.equipped ? styles.chipActive : ""}`}
                onClick={() => toggle(c)}
                disabled={busy}
                title={c.description ?? undefined}
              >
                <span
                  className={styles.bgSwatch}
                  style={
                    c.data?.background
                      ? { background: c.data.background }
                      : undefined
                  }
                />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
