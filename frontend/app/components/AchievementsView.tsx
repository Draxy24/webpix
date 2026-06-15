"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import styles from "./AchievementsView.module.css";
import { API_URL } from "@/app/lib/api";
import { achievementName, achievementDesc } from "@/app/lib/achievementText";

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
  const { t } = useTranslation();
  const { token } = useAuth();
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(API_URL + "/achievements/me", {
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
    return <p className={styles.muted}>{t("achievements.loginRequired")}</p>;
  if (loading)
    return <p className={styles.muted}>{t("achievements.loading")}</p>;
  if (items.length === 0)
    return <p className={styles.muted}>{t("achievements.empty")}</p>;

  return (
    <div className={styles.container}>
      <h4 className={styles.sectionTitle}>{t("achievements.title")}</h4>
      <div className={styles.list}>
        {items.map((a) => {
          const pct = Math.min(
            100,
            Math.round((a.progress / a.threshold) * 100),
          );
          const name = achievementName(a.key, a.name, t);
          const desc = achievementDesc(a.key, a.description, t);
          return (
            <div
              key={a.key}
              className={`${styles.card} ${a.completed ? styles.cardDone : ""}`}
            >
              <div className={styles.cardHead}>
                <span className={styles.name}>
                  {a.completed ? "✓ " : ""}
                  {name}
                </span>
                <span className={styles.reward}>
                  +{a.rewardXp} XP · +{a.rewardBits} Bits
                </span>
              </div>
              {desc && <p className={styles.desc}>{desc}</p>}
              <div className={styles.bar}>
                <div className={styles.fill} style={{ width: `${pct}%` }} />
              </div>
              <div className={styles.progressText}>
                {a.completed
                  ? t("achievements.completed")
                  : `${a.progress} / ${a.threshold}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
