"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import { API_URL } from "@/app/lib/api";

type ReportType = "USER" | "PUBLICATION" | "COMMENT" | "CANVAS";

const REASONS: Record<ReportType, string[]> = {
  USER: ["nsfw", "harassment", "spam", "hate", "impersonation", "other"],
  PUBLICATION: ["nsfw", "spam", "hate", "other"],
  COMMENT: ["harassment", "spam", "hate", "explicit", "other"],
  CANVAS: ["nsfw", "hate", "offensive_symbol", "spam", "other"],
};

export default function ReportModal({
  type,
  targetNickname,
  publicationId,
  commentId,
  x1,
  y1,
  x2,
  y2,
  onClose,
}: {
  type: ReportType;
  targetNickname?: string;
  publicationId?: number;
  commentId?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [reason, setReason] = useState(REASONS[type][0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(API_URL + "/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          targetNickname,
          publicationId,
          commentId,
          x1,
          y1,
          x2,
          y2,
          reason,
          details: details || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? t("report.error"));
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("report.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          color: "#000",
          padding: "20px",
          borderRadius: "8px",
          width: "320px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {done ? (
          <>
            <h3 style={{ margin: 0 }}>{t("report.sentTitle")}</h3>
            <p style={{ fontSize: "14px" }}>{t("report.sentBody")}</p>
            <button
              onClick={onClose}
              style={{ padding: "8px 12px", cursor: "pointer" }}
            >
              {t("common.close")}
            </button>
          </>
        ) : (
          <>
            <h3 style={{ margin: 0 }}>{t(`report.titles.${type}`)}</h3>
            <label style={{ fontSize: "13px" }}>{t("report.reasonLabel")}</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                padding: "8px",
                fontSize: "14px",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {REASONS[type].map((r) => (
                <option key={r} value={r}>
                  {t(`report.reasons.${r}`)}
                </option>
              ))}
            </select>
            <label style={{ fontSize: "13px" }}>
              {t("report.detailsLabel")}
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t("report.detailsPlaceholder")}
              style={{
                padding: "8px",
                fontSize: "14px",
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
            {error && (
              <p style={{ color: "red", fontSize: "13px", margin: 0 }}>
                {error}
              </p>
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button
                onClick={onClose}
                style={{ padding: "8px 12px", cursor: "pointer", flex: 1 }}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  flex: 1,
                  background: "#c33",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                }}
              >
                {submitting ? t("report.submitting") : t("report.submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}