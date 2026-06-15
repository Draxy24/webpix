"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import styles from "./WeeklyTasksView.module.css";
import { API_URL } from "@/app/lib/api";
import { taskName, taskDesc } from "@/app/lib/achievementText";

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
  const { t } = useTranslation();
  const { token } = useAuth();
  const [items, setItems] = useState<WeeklyTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(API_URL + "/weekly-tasks/me", {
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

  if (!token) return <p className={styles.muted}>{t("tasks.loginRequired")}</p>;
  if (loading) return <p className={styles.muted}>{t("tasks.loading")}</p>;
  if (items.length === 0)
    return <p className={styles.muted}>{t("tasks.empty")}</p>;

  const doneCount = items.filter((task) => task.completed).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t("tasks.header")}</span>
        <span className={styles.headerCount}>
          {doneCount} / {items.length}
        </span>
      </div>
      <p className={styles.subtitle}>{t("tasks.subtitle")}</p>

      <div className={styles.list}>
        {items.map((task) => {
          const pct = Math.min(
            100,
            Math.round((task.progress / task.threshold) * 100),
          );
          const name = taskName(task.key, task.name, t);
          const desc = taskDesc(task.key, task.description, t);
          return (
            <div
              key={task.key}
              className={`${styles.card} ${task.completed ? styles.cardDone : ""}`}
            >
              <div className={styles.cardHead}>
                <span className={styles.name}>
                  {task.completed ? "✓ " : ""}
                  {name}
                </span>
                <span className={styles.reward}>
                  +{task.rewardXp} XP · +{task.rewardBits} Bits
                </span>
              </div>
              {desc && <p className={styles.desc}>{desc}</p>}
              <div className={styles.bar}>
                <div className={styles.fill} style={{ width: `${pct}%` }} />
              </div>
              <div className={styles.progressText}>
                {task.completed
                  ? t("tasks.completed")
                  : `${task.progress} / ${task.threshold}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
