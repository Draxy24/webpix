"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/auth";
import styles from "./AchievementsView.module.css";

type Achievement = {
  key: string;
  name: string;
  description: string | null;
  metric: string;
  threshold: number;
  progress: number;
  completed: boolean;
  completedAt: string | null;
  rewardXp: number;
  rewardBits: number;
};

export default function AchievementsView() {
  const { token } = useAuth();
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("http://localhost:3001/achievements/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(await res.json());
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (!token)
    return <p className={styles.muted}>Inicia sesión para ver tus logros.</p>;
  if (loading) return <p className={styles.muted}>Cargando logros...</p>;
  if (items.length === 0)
    return <p className={styles.muted}>Aún no hay logros disponibles.</p>;

  return (
    <div className={styles.container}>
      <h4 className={styles.sectionTitle}>Logros</h4>
      <div className={styles.list}>
        {items.map((a) => {
          const pct = Math.min(
            100,
            Math.round((a.progress / a.threshold) * 100),
          );
          return (
            <div
              key={a.key}
              className={`${styles.card} ${a.completed ? styles.cardDone : ""}`}
            >
              <div className={styles.cardHead}>
                <span className={styles.name}>
                  {a.completed ? "✓ " : ""}
                  {a.name}
                </span>
                <span className={styles.reward}>
                  +{a.rewardXp} XP · +{a.rewardBits} Bits
                </span>
              </div>
              {a.description && <p className={styles.desc}>{a.description}</p>}
              <div className={styles.bar}>
                <div className={styles.fill} style={{ width: `${pct}%` }} />
              </div>
              <div className={styles.progressText}>
                {a.completed ? "Completado" : `${a.progress} / ${a.threshold}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
