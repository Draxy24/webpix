"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import styles from "./RewardsView.module.css";
import { badgeIcon } from "../lib/badges";
import { cosmeticName, cosmeticDesc } from "../lib/cosmeticText";
import { API_URL } from "@/app/lib/api";

type Progression = {
  bits: number;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  currencyNamePlural: string;
  equippedTitle: { id: number; key: string; name: string } | null;
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
    image?: string;
  } | null;
  equipped: boolean;
};

export default function RewardsView() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [prog, setProg] = useState<Progression | null>(null);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const pRes = await fetch(API_URL + "/rewards/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProg(await pRes.json());
      const cRes = await fetch(API_URL + "/rewards/cosmetics", {
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
      await fetch(`${API_URL}/rewards/${endpoint}`, {
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

  if (loading) return <p className={styles.muted}>{t("rewards.loading")}</p>;
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
            {t("rewards.level", { level: prog.level })}
            {prog.equippedTitle
              ? ` · ${cosmeticName(prog.equippedTitle.key, prog.equippedTitle.name, t)}`
              : ""}
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
            : t("rewards.maxLevel")}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>{t("rewards.sections.titles")}</h4>
        {titles.length === 0 ? (
          <p className={styles.muted}>{t("rewards.empty.titles")}</p>
        ) : (
          <div className={styles.chips}>
            {titles.map((c) => (
              <button
                key={c.cosmeticId}
                className={`${styles.chip} ${c.equipped ? styles.chipActive : ""}`}
                onClick={() => toggle(c)}
                disabled={busy}
                title={cosmeticDesc(c.key, c.description, t) || undefined}
                style={
                  c.data?.color
                    ? { color: c.data.color, borderColor: c.data.color }
                    : undefined
                }
              >
                {cosmeticName(c.key, c.name, t)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>{t("rewards.sections.badges")}</h4>
        {badges.length === 0 ? (
          <p className={styles.muted}>{t("rewards.empty.badges")}</p>
        ) : (
          <div className={styles.chips}>
            {badges.map((c) => (
              <button
                key={c.cosmeticId}
                className={`${styles.chip} ${c.equipped ? styles.chipActive : ""}`}
                onClick={() => toggle(c)}
                disabled={busy}
                title={cosmeticDesc(c.key, c.description, t) || undefined}
              >
                {badgeIcon(c.data?.icon)} {cosmeticName(c.key, c.name, t)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>{t("rewards.sections.frames")}</h4>
        {frames.length === 0 ? (
          <p className={styles.muted}>{t("rewards.empty.frames")}</p>
        ) : (
          <div className={styles.chips}>
            {frames.map((c) => (
              <button
                key={c.cosmeticId}
                className={`${styles.chip} ${c.equipped ? styles.chipActive : ""}`}
                onClick={() => toggle(c)}
                disabled={busy}
                title={cosmeticDesc(c.key, c.description, t) || undefined}
              >
                {c.data?.image ? (
                  <img
                    src={c.data.image}
                    alt=""
                    className={styles.ringSwatchImg}
                  />
                ) : (
                  <span
                    className={styles.ringSwatch}
                    style={
                      c.data?.ring ? { background: c.data.ring } : undefined
                    }
                  />
                )}
                {cosmeticName(c.key, c.name, t)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>
          {t("rewards.sections.backgrounds")}
        </h4>
        {backgrounds.length === 0 ? (
          <p className={styles.muted}>{t("rewards.empty.backgrounds")}</p>
        ) : (
          <div className={styles.chips}>
            {backgrounds.map((c) => (
              <button
                key={c.cosmeticId}
                className={`${styles.chip} ${c.equipped ? styles.chipActive : ""}`}
                onClick={() => toggle(c)}
                disabled={busy}
                title={cosmeticDesc(c.key, c.description, t) || undefined}
              >
                <span
                  className={styles.bgSwatch}
                  style={
                    c.data?.background
                      ? { background: c.data.background }
                      : undefined
                  }
                />
                {cosmeticName(c.key, c.name, t)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
