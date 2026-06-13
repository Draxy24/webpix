"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import Button from "./Button";
import styles from "./BugReportView.module.css";
import { API_URL } from "@/app/lib/api";

export default function BugReportView() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(API_URL + "/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: "BUG", reason: title, details: steps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? t("bug.error"));
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("bug.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return <p className={styles.muted}>{t("bug.loginRequired")}</p>;
  }

  if (done) {
    return (
      <div className={styles.success}>
        <div className={styles.successTitle}>{t("bug.success.title")} 🐛</div>
        <p className={styles.successText}>{t("bug.success.text")}</p>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setTitle("");
            setSteps("");
            setDone(false);
          }}
        >
          {t("bug.success.again")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.container}>
      <p className={styles.intro}>{t("bug.intro")}</p>

      <div className={styles.field}>
        <label className={styles.label}>{t("bug.titleLabel")}</label>
        <input
          type="text"
          placeholder={t("bug.titlePlaceholder")}
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          {t("bug.stepsLabel")} <span className={styles.required}>*</span>
        </label>
        <textarea
          placeholder={t("bug.stepsPlaceholder")}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          required
          rows={7}
          maxLength={1000}
          className={styles.textarea}
        />
        <span className={styles.hint}>{t("bug.hint")}</span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <Button
        type="submit"
        disabled={submitting || !title.trim() || !steps.trim()}
        fullWidth
      >
        {submitting ? t("bug.submitting") : t("bug.submit")}
      </Button>
    </form>
  );
}
