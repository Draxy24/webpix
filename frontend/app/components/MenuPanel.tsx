"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "./Button";
import Flag from "./Flag";
import { COUNTRIES } from "../lib/countries";
import { countryName } from "@/app/lib/countryName";
import { useAuth } from "../context/auth";
import styles from "./MenuPanel.module.css";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import RankingsView from "./RankingsView";
import FriendsView from "./FriendsView";
import RewardsView from "./RewardsView";
import { useProfileModal } from "./ProfileModalContext";
import { API_URL } from "@/app/lib/api";

export default function MenuPanel({
  nickname,
  userTier,
  isAdmin,
  onLogout,
  onNavigate,
  onClose,
}: {
  nickname: string | null;
  userTier: "FREE" | "PLUS" | "PREMIUM";
  isAdmin: boolean;
  onLogout: () => void;
  onNavigate: (path: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const { openProfile } = useProfileModal();
  const goToProfile = (nick: string) => {
    openProfile(nick);
    onClose();
  };
  const [tab, setTab] = useState<"profile" | "rankings" | "friends">("profile");

  const [profilePic, setProfilePic] = useState("");
  const [country, setCountry] = useState("");
  const [stats, setStats] = useState<{
    pixelCount: number;
    createdAt: string;
  } | null>(null);

  const [editing, setEditing] = useState(false);
  const [picInput, setPicInput] = useState("");
  const [countryInput, setCountryInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [frameRing, setFrameRing] = useState<string | null>(null);
  const [frameImg, setFrameImg] = useState<string | null>(null);

  useEffect(() => {
    if (!nickname) return;
    fetch(`${API_URL}/users/${nickname}`)
      .then((res) => res.json())
      .then((data) => {
        setProfilePic(data.profilePic ?? "");
        setCountry(data.country ?? "");
        setStats({ pixelCount: data.pixelCount, createdAt: data.createdAt });
        setFrameRing(data.frame?.data?.ring ?? null);
        setFrameImg(data.frame?.data?.image ?? null);
      })
      .catch(() => {});
  }, [nickname]);

  const startEdit = () => {
    setPicInput(profilePic);
    setCountryInput(country);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(API_URL + "/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profilePic: picInput, country: countryInput }),
      });
      if (res.ok) {
        setProfilePic(picInput);
        setCountry(countryInput);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "profile" ? styles.tabActive : ""}`}
          onClick={() => setTab("profile")}
        >
          {t("menu.tabs.profile")}
        </button>
        <button
          className={`${styles.tab} ${tab === "rankings" ? styles.tabActive : ""}`}
          onClick={() => setTab("rankings")}
        >
          {t("menu.tabs.rankings")}
        </button>
        <button
          className={`${styles.tab} ${tab === "friends" ? styles.tabActive : ""}`}
          onClick={() => setTab("friends")}
        >
          {t("menu.tabs.friends")}
        </button>
      </div>

      {tab === "profile" &&
        (nickname ? (
          editing ? (
            <div className={styles.box}>
              <label className={styles.editLabel}>
                {t("menu.edit.picUrl")}
              </label>
              <input
                type="text"
                value={picInput}
                onChange={(e) => setPicInput(e.target.value)}
                placeholder="https://..."
                className={styles.editInput}
              />
              <label className={styles.editLabel}>
                {t("menu.edit.country")}
              </label>
              <select
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                className={styles.editInput}
              >
                <option value="">{t("menu.edit.noCountry")}</option>
                {COUNTRIES.map((c) => ({
                  code: c.code,
                  label: countryName(c.code, i18n.language),
                }))
                  .sort((a, b) => a.label.localeCompare(b.label, i18n.language))
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
              </select>
              <Button
                variant="primary"
                fullWidth
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t("common.saving") : t("common.save")}
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setEditing(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
            <>
              <div className={styles.box}>
                <div
                  className={styles.avatarFrame}
                  style={
                    frameImg
                      ? undefined
                      : frameRing
                        ? { background: frameRing }
                        : undefined
                  }
                >
                  <div
                    className={styles.avatar}
                    style={
                      profilePic
                        ? {
                            backgroundImage: `url(${profilePic})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  >
                    {!profilePic && nickname.charAt(0).toUpperCase()}
                  </div>
                  {frameImg && (
                    <img src={frameImg} alt="" className={styles.frameImage} />
                  )}
                </div>
                <div className={styles.nameRow}>
                  <span className={styles.nickname}>{nickname}</span>
                  {country && <Flag code={country} />}
                </div>
                <div className={styles.tier}>
                  {isAdmin ? t("menu.admin") : userTier}
                </div>
                {stats && (
                  <div className={styles.stats}>
                    <span>
                      <strong>{stats.pixelCount}</strong>{" "}
                      {t("menu.stats.pixelsLabel")}
                    </span>
                    <span>
                      {t("menu.stats.memberSince", {
                        date: new Date(stats.createdAt).toLocaleDateString(
                          i18n.language,
                        ),
                      })}
                    </span>
                  </div>
                )}
                <Button variant="secondary" fullWidth onClick={startEdit}>
                  {t("menu.buttons.editProfile")}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => goToProfile(nickname)}
                >
                  {t("menu.buttons.viewPublications")}
                </Button>
                {isAdmin && (
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => onNavigate("/admin")}
                  >
                    {t("menu.buttons.modPanel")}
                  </Button>
                )}
                <Button variant="ghost" fullWidth onClick={onLogout}>
                  {t("menu.buttons.logout")}
                </Button>
              </div>
              <RewardsView />
            </>
          )
        ) : (
          <div className={styles.box}>
            {authMode === "login" ? (
              <LoginForm
                onSuccess={onClose}
                switchToRegister={() => setAuthMode("register")}
              />
            ) : (
              <RegisterForm switchToLogin={() => setAuthMode("login")} />
            )}
          </div>
        ))}

      {tab === "rankings" && <RankingsView onOpenProfile={goToProfile} />}

      {tab === "friends" &&
        (nickname ? (
          <FriendsView onOpenProfile={goToProfile} />
        ) : (
          <p className={styles.muted}>{t("menu.friends.loginPrompt")}</p>
        ))}
    </div>
  );
}
