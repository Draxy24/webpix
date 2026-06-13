"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";
import Button from "../components/Button";
import styles from "./admin.module.css";
import { API_URL } from "@/app/lib/api";

type Report = {
  id: number;
  type: "USER" | "PUBLICATION" | "COMMENT" | "BUG" | "CANVAS";
  reason: string;
  details: string | null;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reporterNickname: string;
  targetUserId: number | null;
  targetNickname: string | null;
  publicationId: number | null;
  commentId: number | null;
  x1: number | null;
  y1: number | null;
  x2: number | null;
  y2: number | null;
  contentAuthorId: number | null;
  contentAuthorNickname: string | null;
  contentPreview: string | null;
};

type LogEntry = {
  id: number;
  action: string;
  moderator: string;
  targetNickname: string | null;
  details: string | null;
  createdAt: string;
};

const TYPE_COLORS: Record<string, string> = {
  USER: "#c33",
  PUBLICATION: "#a60",
  COMMENT: "#36c",
  BUG: "#693",
  CANVAS: "#7c3aed",
};

function BanModal({
  target,
  token,
  onClose,
  onDone,
}: {
  target: { userId: number; nickname: string };
  token: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [permanent, setPermanent] = useState(false);
  const [days, setDays] = useState(3);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleBan = async () => {
    if (!reason.trim()) {
      setError(t("admin.banModal.reasonRequired"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(API_URL + "/moderation/ban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: target.userId,
          durationDays: permanent ? null : days,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? t("admin.banModal.error"));
      onDone();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.banModal.errorGeneric"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>
          {t("admin.banUser", { nickname: target.nickname })}
        </h3>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={permanent}
            onChange={(e) => setPermanent(e.target.checked)}
          />
          {t("admin.banModal.permanent")}
        </label>
        {!permanent && (
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>
              {t("admin.banModal.durationDays")}
            </label>
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) =>
                setDays(Math.max(1, parseInt(e.target.value) || 1))
              }
              className={styles.modalInput}
            />
          </div>
        )}
        <div className={styles.modalField}>
          <label className={styles.modalLabel}>
            {t("admin.banModal.reason")}
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("admin.banModal.reasonPlaceholder")}
            className={styles.modalInput}
          />
        </div>
        {error && <p className={styles.modalError}>{error}</p>}
        <div className={styles.modalButtons}>
          <div style={{ flex: 1 }}>
            <Button variant="secondary" fullWidth onClick={onClose}>
              {t("common.cancel")}
            </Button>
          </div>
          <div style={{ flex: 1 }}>
            <Button
              variant="danger"
              fullWidth
              onClick={handleBan}
              disabled={submitting}
            >
              {submitting
                ? t("admin.banModal.banning")
                : t("admin.banModal.ban")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const { token, loading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  const [tab, setTab] = useState<"reports" | "log">("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [typeFilter, setTypeFilter] = useState("");
  const [loadingReports, setLoadingReports] = useState(false);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  const [banTarget, setBanTarget] = useState<{
    userId: number;
    nickname: string;
  } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    fetch(API_URL + "/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.isAdmin) {
          router.push("/");
          return;
        }
        setAuthorized(true);
        setChecking(false);
      });
  }, [token, loading, router]);

  const loadReports = useCallback(async () => {
    if (!token) return;
    setLoadingReports(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    const res = await fetch(
      `${API_URL}/moderation/reports?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await res.json();
    setReports(data);
    setLoadingReports(false);
  }, [token, statusFilter, typeFilter]);

  const loadLog = useCallback(async () => {
    if (!token) return;
    setLoadingLog(true);
    const res = await fetch(API_URL + "/moderation/log", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setLog(data);
    setLoadingLog(false);
  }, [token]);

  useEffect(() => {
    if (authorized && tab === "reports") loadReports();
  }, [authorized, tab, loadReports]);

  useEffect(() => {
    if (authorized && tab === "log") loadLog();
  }, [authorized, tab, loadLog]);

  const action = async (url: string, method: string) => {
    await fetch(`${API_URL}${url}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    loadReports();
  };

  if (loading || checking) {
    return <main className={styles.centered}>{t("common.loading")}</main>;
  }

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("admin.title")}</h1>
        <a href="/" className={styles.backLink}>
          ← {t("profile.backToCanvas")}
        </a>
      </div>

      <div className={styles.tabs}>
        <button
          onClick={() => setTab("reports")}
          className={`${styles.tab} ${tab === "reports" ? styles.tabActive : ""}`}
        >
          {t("admin.tabs.reports")}
        </button>
        <button
          onClick={() => setTab("log")}
          className={`${styles.tab} ${tab === "log" ? styles.tabActive : ""}`}
        >
          {t("admin.tabs.log")}
        </button>
      </div>

      {tab === "reports" && (
        <>
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>
                {t("admin.filters.status")}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.select}
              >
                <option value="PENDING">
                  {t("admin.statusOption.PENDING")}
                </option>
                <option value="RESOLVED">
                  {t("admin.statusOption.RESOLVED")}
                </option>
                <option value="DISMISSED">
                  {t("admin.statusOption.DISMISSED")}
                </option>
                <option value="">{t("admin.statusOption.ALL")}</option>
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>
                {t("admin.filters.type")}
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={styles.select}
              >
                <option value="">{t("admin.typeOption.ALL")}</option>
                <option value="USER">{t("admin.typeOption.USER")}</option>
                <option value="PUBLICATION">
                  {t("admin.typeOption.PUBLICATION")}
                </option>
                <option value="COMMENT">{t("admin.typeOption.COMMENT")}</option>
                <option value="BUG">{t("admin.typeOption.BUG")}</option>
                <option value="CANVAS">{t("admin.typeOption.CANVAS")}</option>
              </select>
            </div>
          </div>

          <div className={styles.list}>
            {loadingReports ? (
              <p className={styles.muted}>{t("admin.reports.loading")}</p>
            ) : reports.length === 0 ? (
              <p className={styles.muted}>{t("admin.reports.empty")}</p>
            ) : (
              reports.map((r) => {
                const responsible =
                  r.type === "USER" && r.targetUserId
                    ? {
                        userId: r.targetUserId,
                        nickname: r.targetNickname ?? "?",
                      }
                    : r.contentAuthorId
                      ? {
                          userId: r.contentAuthorId,
                          nickname: r.contentAuthorNickname ?? "?",
                        }
                      : null;

                return (
                  <div key={r.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span
                        className={styles.badge}
                        style={{ background: TYPE_COLORS[r.type] }}
                      >
                        {t(`admin.typeLabel.${r.type}`)}
                      </span>
                      <span className={styles.cardMeta}>
                        {t(`admin.statusLabel.${r.status}`)} ·{" "}
                        {new Date(r.createdAt).toLocaleString(i18n.language)}
                      </span>
                    </div>

                    <div className={styles.cardBody}>
                      <div>
                        <strong>{t("admin.reports.reportedBy")}</strong>{" "}
                        {r.reporterNickname}
                      </div>
                      {r.type === "USER" && (
                        <div>
                          <strong>{t("admin.reports.reportedUser")}</strong>{" "}
                          {r.targetNickname ?? "?"}
                        </div>
                      )}
                      {(r.type === "PUBLICATION" || r.type === "COMMENT") && (
                        <>
                          <div>
                            <strong>{t("admin.reports.contentAuthor")}</strong>{" "}
                            {r.contentAuthorNickname ?? "?"}
                          </div>
                          <div className={styles.preview}>
                            “{r.contentPreview}”
                          </div>
                        </>
                      )}
                      {r.type === "CANVAS" && (
                        <div>
                          <strong>{t("admin.reports.reportedZone")}</strong>{" "}
                          {r.x1 != null
                            ? `(${r.x1}, ${r.y1}) – (${r.x2}, ${r.y2})`
                            : "?"}
                        </div>
                      )}
                      <div style={{ marginTop: "4px" }}>
                        <strong>{t("admin.reports.reason")}</strong> {r.reason}
                      </div>
                      {r.details && (
                        <div className={styles.details}>{r.details}</div>
                      )}
                    </div>

                    <div className={styles.actions}>
                      {r.type === "PUBLICATION" && r.publicationId && (
                        <>
                          <a
                            href={`/publication/${r.publicationId}`}
                            target="_blank"
                            className={`${styles.actionBtn} ${styles.actionNeutral}`}
                          >
                            {t("admin.reports.viewPublication")}
                          </a>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  t("admin.reports.confirmDeletePublication"),
                                )
                              )
                                action(
                                  `/moderation/publication/${r.publicationId}`,
                                  "DELETE",
                                );
                            }}
                            className={`${styles.actionBtn} ${styles.actionWarn}`}
                          >
                            {t("admin.reports.deletePublication")}
                          </button>
                        </>
                      )}
                      {r.type === "COMMENT" && r.commentId && (
                        <button
                          onClick={() => {
                            if (
                              confirm(t("admin.reports.confirmDeleteComment"))
                            )
                              action(
                                `/moderation/comment/${r.commentId}`,
                                "DELETE",
                              );
                          }}
                          className={`${styles.actionBtn} ${styles.actionWarn}`}
                        >
                          {t("admin.reports.deleteComment")}
                        </button>
                      )}
                      {responsible && (
                        <button
                          onClick={() => setBanTarget(responsible)}
                          className={`${styles.actionBtn} ${styles.actionDanger}`}
                        >
                          {t("admin.banUser", {
                            nickname: responsible.nickname,
                          })}
                        </button>
                      )}
                      {r.status === "PENDING" && (
                        <>
                          <button
                            onClick={() =>
                              action(
                                `/moderation/reports/${r.id}/resolve`,
                                "PATCH",
                              )
                            }
                            className={`${styles.actionBtn} ${styles.actionSuccess}`}
                          >
                            {t("admin.reports.resolve")}
                          </button>
                          <button
                            onClick={() =>
                              action(
                                `/moderation/reports/${r.id}/dismiss`,
                                "PATCH",
                              )
                            }
                            className={`${styles.actionBtn} ${styles.actionNeutral}`}
                          >
                            {t("admin.reports.dismiss")}
                          </button>
                        </>
                      )}
                      {r.type === "CANVAS" && r.x1 != null && (
                        <a
                          href={`/?zone=${r.x1}_${r.y1}_${r.x2}_${r.y2}`}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.actionBtn} ${styles.actionNeutral}`}
                        >
                          {t("admin.reports.goToZone")}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {tab === "log" && (
        <div className={styles.logList}>
          {loadingLog ? (
            <p className={styles.muted}>{t("admin.log.loading")}</p>
          ) : log.length === 0 ? (
            <p className={styles.muted}>{t("admin.log.empty")}</p>
          ) : (
            log.map((entry) => (
              <div key={entry.id} className={styles.logEntry}>
                <div className={styles.logTop}>
                  <span className={styles.logAction}>
                    {t(`admin.actionLabel.${entry.action}`, {
                      defaultValue: entry.action,
                    })}
                  </span>
                  <span className={styles.cardMeta}>
                    {new Date(entry.createdAt).toLocaleString(i18n.language)}
                  </span>
                </div>
                <div className={styles.logMeta}>
                  {t("admin.log.by")} <strong>{entry.moderator}</strong>
                  {entry.targetNickname && (
                    <>
                      {" "}
                      · {t("admin.log.about")}{" "}
                      <strong>{entry.targetNickname}</strong>
                    </>
                  )}
                  {entry.details && <> · {entry.details}</>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {banTarget && (
        <BanModal
          target={banTarget}
          token={token}
          onClose={() => setBanTarget(null)}
          onDone={() => {
            setBanTarget(null);
            loadReports();
          }}
        />
      )}
    </main>
  );
}
