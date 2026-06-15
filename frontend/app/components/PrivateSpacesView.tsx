"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import Button from "./Button";
import styles from "./PrivateSpacesView.module.css";
import { API_URL } from "@/app/lib/api";
import { apiErrorText } from "@/app/lib/apiError";

type Space = {
  id: number;
  name: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  accessMode: "OWNER_ONLY" | "FRIENDS" | "SPECIFIC";
  purchaseType: "MONTHLY" | "PERMANENT";
  expiresAt: string | null;
  active: boolean;
  pixels: number;
  members: string[];
};

const ACCESS_KEY: Record<Space["accessMode"], string> = {
  OWNER_ONLY: "canvas.purchase.ownerOnly",
  FRIENDS: "canvas.purchase.friends",
  SPECIFIC: "canvas.purchase.specific",
};

export default function PrivateSpacesView() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(API_URL + "/private-spaces/mine", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSpaces(Array.isArray(data) ? data : []);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className={styles.muted}>{t("spaces.loading")}</p>;
  }
  if (spaces.length === 0) {
    return <p className={styles.muted}>{t("spaces.empty")}</p>;
  }

  return (
    <div className={styles.list}>
      {spaces.map((sp) => (
        <SpaceCard key={sp.id} space={sp} token={token!} onChanged={load} />
      ))}
    </div>
  );
}

function SpaceCard({
  space,
  token,
  onChanged,
}: {
  space: Space;
  token: string;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [memberInput, setMemberInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/private-spaces/${space.id}/access`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(apiErrorText(data, t, t("spaces.updateFailed")));
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("spaces.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const changeMode = (mode: Space["accessMode"]) => {
    if (mode === space.accessMode) return;
    patch({ accessMode: mode });
  };

  const addMember = async () => {
    const nick = memberInput.trim();
    if (!nick) return;
    await patch({ addNicknames: [nick] });
    setMemberInput("");
  };

  const removeMember = (nick: string) => {
    patch({ removeNicknames: [nick] });
  };

  const release = async () => {
    if (!window.confirm(t("spaces.confirmRelease"))) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/private-spaces/${space.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(apiErrorText(data, t, t("spaces.releaseFailed")));
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("spaces.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const width = space.x2 - space.x1 + 1;
  const height = space.y2 - space.y1 + 1;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.title}>
          {space.name || t("spaces.defaultName", { id: space.id })}
        </span>
        <div className={styles.badges}>
          <span className={styles.badge}>
            {space.purchaseType === "MONTHLY"
              ? t("canvas.purchase.monthly")
              : t("canvas.purchase.permanent")}
          </span>
          {!space.active && (
            <span className={`${styles.badge} ${styles.badgeExpired}`}>
              {t("spaces.expired")}
            </span>
          )}
        </div>
      </div>

      <div className={styles.meta}>
        {t("spaces.position", {
          x: space.x1,
          y: space.y1,
          w: width,
          h: height,
          px: space.pixels,
        })}
      </div>
      {space.purchaseType === "MONTHLY" && space.expiresAt && (
        <div className={styles.meta}>
          {space.active
            ? t("spaces.renewsOn", {
                date: new Date(space.expiresAt).toLocaleDateString(
                  i18n.language,
                ),
              })
            : t("spaces.expiredOn", {
                date: new Date(space.expiresAt).toLocaleDateString(
                  i18n.language,
                ),
              })}
        </div>
      )}

      <div className={styles.modeRow}>
        {(["OWNER_ONLY", "FRIENDS", "SPECIFIC"] as Space["accessMode"][]).map(
          (mode) => (
            <button
              key={mode}
              className={`${styles.modeBtn} ${space.accessMode === mode ? styles.modeBtnActive : ""}`}
              onClick={() => changeMode(mode)}
              disabled={busy}
            >
              {t(ACCESS_KEY[mode])}
            </button>
          ),
        )}
      </div>

      {space.accessMode === "SPECIFIC" && (
        <div className={styles.membersBlock}>
          {space.members.length > 0 ? (
            <div className={styles.members}>
              {space.members.map((m) => (
                <span key={m} className={styles.memberChip}>
                  {m}
                  <button
                    className={styles.chipRemove}
                    onClick={() => removeMember(m)}
                    disabled={busy}
                    aria-label={t("spaces.removeMember", { nick: m })}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className={styles.muted}>{t("spaces.noMembers")}</span>
          )}
          <div className={styles.addRow}>
            <input
              type="text"
              className={styles.input}
              placeholder={t("spaces.addPlaceholder")}
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addMember();
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={addMember}
              disabled={busy || !memberInput.trim()}
            >
              {t("spaces.add")}
            </Button>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <Button
        variant="danger"
        size="sm"
        fullWidth
        onClick={release}
        disabled={busy}
      >
        {t("spaces.release")}
      </Button>
    </div>
  );
}
