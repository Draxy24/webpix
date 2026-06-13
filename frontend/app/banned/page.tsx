"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";
import Button from "../components/Button";
import { API_URL } from "@/app/lib/api";

export default function BannedPage() {
  const { t, i18n } = useTranslation();
  const { token, loading, logout } = useAuth();
  const router = useRouter();
  const [info, setInfo] = useState<{
    banReason: string | null;
    bannedUntil: string | null;
    banPermanent: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(true);

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
        if (!data.banned) {
          router.push("/");
          return;
        }
        setInfo({
          banReason: data.banReason,
          bannedUntil: data.bannedUntil,
          banPermanent: data.banPermanent,
        });
        setChecking(false);
      });
  }, [token, loading, router]);

  if (loading || checking) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-secondary)",
        }}
      >
        {t("common.loading")}
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          width: "440px",
          maxWidth: "100%",
          padding: "var(--space-6)",
          background: "var(--color-surface)",
          border: "var(--border-normal) solid var(--color-danger)",
          borderRadius: "var(--radius-lg)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "var(--space-3)" }}>
          🚫
        </div>
        <h1
          style={{
            color: "var(--color-danger)",
            margin: "0 0 var(--space-3) 0",
            fontFamily: "var(--font-display), monospace",
            fontSize: "var(--text-lg)",
          }}
        >
          {t("banned.title")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-secondary)",
            margin: "0 0 var(--space-4) 0",
          }}
        >
          {t("banned.intro")}
        </p>
        <div
          style={{
            background: "rgba(195, 51, 51, 0.1)",
            border: "var(--border-thin) solid var(--color-danger)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-4)",
            margin: "0 0 var(--space-4) 0",
            textAlign: "left",
            fontSize: "var(--text-sm)",
          }}
        >
          <div style={{ marginBottom: "var(--space-2)" }}>
            <strong>{t("banned.reason")}</strong>{" "}
            {info?.banReason ?? t("banned.reasonUnknown")}
          </div>
          <div>
            <strong>{t("banned.duration")}</strong>{" "}
            {info?.banPermanent
              ? t("banned.permanent")
              : info?.bannedUntil
                ? t("banned.until", {
                    date: new Date(info.bannedUntil).toLocaleString(
                      i18n.language,
                    ),
                  })
                : t("banned.durationUnknown")}
          </div>
        </div>
        <p
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
            margin: "0 0 var(--space-4) 0",
          }}
        >
          {t("banned.contactSupport")}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            logout();
            router.push("/login");
          }}
        >
          {t("menu.buttons.logout")}
        </Button>
      </div>
    </main>
  );
}
