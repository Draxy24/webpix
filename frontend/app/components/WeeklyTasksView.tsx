"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/auth";
import styles from "./WeeklyTasksView.module.css";

type WeeklyTask = {
  key: string;
  name: string;
  description: string | null;
  threshold: number;
  progress: number;
  completed: boolean;
  rewardXp: number;
  rewardBits: number;
  weekKey: string;
};

export default function WeeklyTasksView() {
  const { token } = useAuth();
  const [items, setItems] = useState<WeeklyTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("http://localhost:3001/weekly-tasks/me", {
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
    return <p className={styles.muted}>Inicia sesión para ver tus tareas.</p>;
  if (loading) return <p className={styles.muted}>Cargando tareas...</p>;
  if (items.length === 0)
    return <p className={styles.muted}>Aún no hay tareas disponibles.</p>;

  const doneCount = items.filter((t) => t.completed).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Tareas de la semana</span>
        <span className={styles.headerCount}>
          {doneCount} / {items.length}
        </span>
      </div>
      <p className={styles.subtitle}>Se reinician cada semana.</p>

      <div className={styles.list}>
        {items.map((t) => {
          const pct = Math.min(
            100,
            Math.round((t.progress / t.threshold) * 100),
          );
          return (
            <div
              key={t.key}
              className={`${styles.card} ${t.completed ? styles.cardDone : ""}`}
            >
              <div className={styles.cardHead}>
                <span className={styles.name}>
                  {t.completed ? "✓ " : ""}
                  {t.name}
                </span>
                <span className={styles.reward}>
                  +{t.rewardXp} XP · +{t.rewardBits} Bits
                </span>
              </div>
              {t.description && <p className={styles.desc}>{t.description}</p>}
              <div className={styles.bar}>
                <div className={styles.fill} style={{ width: `${pct}%` }} />
              </div>
              <div className={styles.progressText}>
                {t.completed ? "Completada" : `${t.progress} / ${t.threshold}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
