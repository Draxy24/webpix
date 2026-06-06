"use client";

import { useEffect, useState } from "react";
import Button from "./Button";
import Flag from "./Flag";
import { COUNTRIES } from "../lib/countries";
import { useAuth } from "../context/auth";
import styles from "./MenuPanel.module.css";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import RankingsView from "./RankingsView";
import FriendsView from "./FriendsView";
import RewardsView from "./RewardsView";
import { useProfileModal } from "./ProfileModalContext";

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

  useEffect(() => {
    if (!nickname) return;
    fetch(`http://localhost:3001/users/${nickname}`)
      .then((res) => res.json())
      .then((data) => {
        setProfilePic(data.profilePic ?? "");
        setCountry(data.country ?? "");
        setStats({ pixelCount: data.pixelCount, createdAt: data.createdAt });
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
      const res = await fetch("http://localhost:3001/users/me", {
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
          Perfil
        </button>
        <button
          className={`${styles.tab} ${tab === "rankings" ? styles.tabActive : ""}`}
          onClick={() => setTab("rankings")}
        >
          Rankings
        </button>
        <button
          className={`${styles.tab} ${tab === "friends" ? styles.tabActive : ""}`}
          onClick={() => setTab("friends")}
        >
          Amigos
        </button>
      </div>

      {tab === "profile" &&
        (nickname ? (
          editing ? (
            <div className={styles.box}>
              <label className={styles.editLabel}>URL de foto de perfil</label>
              <input
                type="text"
                value={picInput}
                onChange={(e) => setPicInput(e.target.value)}
                placeholder="https://..."
                className={styles.editInput}
              />
              <label className={styles.editLabel}>País</label>
              <select
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                className={styles.editInput}
              >
                <option value="">Sin país</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                fullWidth
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <>
              <div className={styles.box}>
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
                <div className={styles.nameRow}>
                  <span className={styles.nickname}>{nickname}</span>
                  {country && <Flag code={country} />}
                </div>
                <div className={styles.tier}>
                  {isAdmin ? "Admin" : userTier}
                </div>
                {stats && (
                  <div className={styles.stats}>
                    <span>
                      <strong>{stats.pixelCount}</strong> píxeles pintados
                    </span>
                    <span>
                      Miembro desde{" "}
                      {new Date(stats.createdAt).toLocaleDateString("es-MX")}
                    </span>
                  </div>
                )}
                <Button variant="secondary" fullWidth onClick={startEdit}>
                  Editar perfil
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => goToProfile(nickname)}
                >
                  Ver publicaciones
                </Button>
                {isAdmin && (
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => onNavigate("/admin")}
                  >
                    Panel de moderación
                  </Button>
                )}
                <Button variant="ghost" fullWidth onClick={onLogout}>
                  Cerrar sesión
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
          <p className={styles.muted}>Inicia sesión para tener amigos.</p>
        ))}
    </div>
  );
}
