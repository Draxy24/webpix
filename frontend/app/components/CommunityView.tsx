"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import styles from "./CommunityView.module.css";
import { API_URL } from "@/app/lib/api";
import { useNotify } from "./NotificationProvider";

type Announcement = {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  authorNickname: string | null;
};

type Snapshot = {
  id: number;
  weekStart: string;
  imageUrl: string;
};

export default function CommunityView({ isAdmin }: { isAdmin: boolean }) {
  const { t, i18n } = useTranslation();
  const { confirm } = useNotify();
  const { token } = useAuth();

  const [tab, setTab] = useState<"announcements" | "snapshots">(
    "announcements",
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        fetch(API_URL + "/community/announcements"),
        fetch(API_URL + "/community/snapshots"),
      ]);
      setAnnouncements(await aRes.json());
      setSnapshots(await sRes.json());
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async () => {
    if (!token || submitting) return;
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(API_URL + "/community/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, body, pinned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("community.form.error"));
      setTitle("");
      setBody("");
      setPinned(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("community.form.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    if (!token) return;
    if (
      !(await confirm({ message: t("community.confirmDelete"), danger: true }))
    )
      return;
    const res = await fetch(`${API_URL}/community/announcements/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) load();
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language);

  const fmtWeek = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const imgSrc = (url: string) =>
    url.startsWith("http") ? url : API_URL + url;

  return (
    <div className={styles.container}>
      <div className={styles.toggleGroup}>
        <button
          onClick={() => setTab("announcements")}
          className={`${styles.toggle} ${tab === "announcements" ? styles.toggleActive : ""}`}
        >
          {t("community.tabs.announcements")}
        </button>
        <button
          onClick={() => setTab("snapshots")}
          className={`${styles.toggle} ${tab === "snapshots" ? styles.toggleActive : ""}`}
        >
          {t("community.tabs.snapshots")}
        </button>
      </div>

      {loading ? (
        <p className={styles.muted}>{t("common.loading")}</p>
      ) : tab === "announcements" ? (
        <>
          {isAdmin && (
            <div className={styles.form}>
              <div className={styles.formHeading}>
                {t("community.form.heading")}
              </div>
              <input
                type="text"
                className={styles.input}
                placeholder={t("community.form.titlePlaceholder")}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className={styles.textarea}
                placeholder={t("community.form.bodyPlaceholder")}
                maxLength={4000}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <label className={styles.pinRow}>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                {t("community.form.pin")}
              </label>
              {error && <div className={styles.error}>{error}</div>}
              <button
                className={styles.publishBtn}
                onClick={publish}
                disabled={submitting || !title.trim() || !body.trim()}
              >
                {submitting
                  ? t("community.form.publishing")
                  : t("community.form.publish")}
              </button>
            </div>
          )}

          {announcements.length === 0 ? (
            <p className={styles.muted}>{t("community.empty.announcements")}</p>
          ) : (
            <div className={styles.list}>
              {announcements.map((a) => (
                <div key={a.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{a.title}</span>
                    {a.pinned && (
                      <span className={styles.pinnedBadge}>
                        {t("community.pinned")}
                      </span>
                    )}
                  </div>
                  <div className={styles.cardBody}>{a.body}</div>
                  <div className={styles.cardFooter}>
                    <span className={styles.cardMeta}>
                      {t("community.meta", {
                        author: a.authorNickname ?? t("community.official"),
                        date: fmtDate(a.createdAt),
                      })}
                    </span>
                    {isAdmin && (
                      <button
                        className={styles.deleteBtn}
                        onClick={() => remove(a.id)}
                      >
                        {t("community.delete")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : snapshots.length === 0 ? (
        <p className={styles.muted}>{t("community.empty.snapshots")}</p>
      ) : (
        <div className={styles.gallery}>
          {snapshots.map((s) => (
            <div key={s.id} className={styles.snapCard}>
              <img src={imgSrc(s.imageUrl)} alt="" className={styles.snapImg} />
              <div className={styles.snapLabel}>
                {t("community.weekOf", { date: fmtWeek(s.weekStart) })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
