"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/auth";
import PublicationCanvas from "./PublicationCanvas";
import Flag from "./Flag";
import ReportModal from "./ReportModal";
import Button from "./Button";
import styles from "./ProfileView.module.css";
import { badgeIcon } from "../lib/badges";

interface Profile {
  nickname: string;
  profilePic: string | null;
  country: string | null;
  createdAt: string;
  pixelCount: number;
  level: number;
  title: { name: string; data: { color?: string } | null } | null;
  badge: { name: string; data: { icon?: string } | null } | null;
  frame: { name: string; data: { ring?: string } | null } | null;
  background: { name: string; data: { background?: string } | null } | null;
}

interface PublicationSummary {
  id: number;
  title: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pixelData: Record<string, string>;
  createdAt: string;
  likes: number;
  dislikes: number;
  commentCount: number;
}

type FriendStatus =
  | "NONE"
  | "FRIENDS"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "SELF";

export default function ProfileView({
  nickname,
  onOpenPublication,
}: {
  nickname: string;
  onOpenPublication?: (id: number) => void;
}) {
  const { nickname: myNickname, token } = useAuth();
  const isOwnProfile = myNickname === nickname;
  const inModal = !!onOpenPublication;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [publications, setPublications] = useState<PublicationSummary[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [friendStatus, setFriendStatus] = useState<{
    status: FriendStatus;
    friendshipId?: number;
  } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://localhost:3001/users/${nickname}`);
        if (!res.ok) throw new Error("Perfil no encontrado");
        const data = await res.json();
        setProfile(data);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [nickname]);

  useEffect(() => {
    if (!token || isOwnProfile || !profile) return;
    fetch(`http://localhost:3001/friendships/status/${nickname}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setFriendStatus);
  }, [token, isOwnProfile, profile, nickname]);

  useEffect(() => {
    if (!profile) return;
    fetch(`http://localhost:3001/publications/user/${nickname}`)
      .then((res) => res.json())
      .then(setPublications);
  }, [profile, nickname]);

  const sendRequest = async () => {
    const res = await fetch("http://localhost:3001/friendships", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ receiverNickname: nickname }),
    });
    if (res.ok) {
      const data = await res.json();
      setFriendStatus({
        status: data.status === "ACCEPTED" ? "FRIENDS" : "REQUEST_SENT",
        friendshipId: data.id,
      });
    }
  };

  const acceptRequest = async () => {
    if (!friendStatus?.friendshipId) return;
    const res = await fetch(
      `http://localhost:3001/friendships/${friendStatus.friendshipId}/accept`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.ok)
      setFriendStatus({
        status: "FRIENDS",
        friendshipId: friendStatus.friendshipId,
      });
  };

  const declineRequest = async () => {
    if (!friendStatus?.friendshipId) return;
    const res = await fetch(
      `http://localhost:3001/friendships/${friendStatus.friendshipId}/decline`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.ok) setFriendStatus({ status: "NONE" });
  };

  const removeFriend = async () => {
    if (!friendStatus?.friendshipId) return;
    const res = await fetch(
      `http://localhost:3001/friendships/${friendStatus.friendshipId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.ok) setFriendStatus({ status: "NONE" });
  };

  if (loading) return <div className={styles.centered}>Cargando...</div>;
  if (!profile)
    return <div className={styles.centered}>Perfil no encontrado</div>;

  const Wrapper: ElementType = inModal ? "div" : "main";

  return (
    <Wrapper className={styles.main}>
      <div
        className={styles.header}
        style={
          profile.background?.data?.background
            ? { background: profile.background.data.background }
            : undefined
        }
      >
        <div
          className={styles.avatarFrame}
          style={
            profile.frame?.data?.ring
              ? { background: profile.frame.data.ring }
              : undefined
          }
        >
          <div
            className={styles.avatar}
            style={
              profile.profilePic
                ? { backgroundImage: `url(${profile.profilePic})` }
                : undefined
            }
          />
        </div>
        <div className={styles.nameRow}>
          <h1 className={styles.nickname}>{profile.nickname}</h1>
          {profile.country && <Flag code={profile.country} />}
        </div>
        {(profile.title || profile.badge) && (
          <div className={styles.cosmeticRow}>
            {profile.title && (
              <span
                className={styles.cosmeticPill}
                style={
                  profile.title.data?.color
                    ? {
                        color: profile.title.data.color,
                        borderColor: profile.title.data.color,
                      }
                    : undefined
                }
              >
                {profile.title.name}
              </span>
            )}
            {profile.badge && (
              <span className={styles.cosmeticPill}>
                {badgeIcon(profile.badge.data?.icon)} {profile.badge.name}
              </span>
            )}
          </div>
        )}
        <div className={styles.stats}>
          <span>
            Nivel <span className={styles.statValue}>{profile.level}</span>
          </span>
          <span>
            <span className={styles.statValue}>{profile.pixelCount}</span>{" "}
            píxeles pintados
          </span>
          <span>
            Miembro desde{" "}
            {new Date(profile.createdAt).toLocaleDateString("es-MX")}
          </span>
        </div>

        {!isOwnProfile && token && friendStatus && (
          <div className={styles.actions}>
            {friendStatus.status === "NONE" && (
              <Button variant="primary" fullWidth onClick={sendRequest}>
                Enviar solicitud de amistad
              </Button>
            )}
            {friendStatus.status === "REQUEST_SENT" && (
              <span className={styles.requestSent}>Solicitud enviada</span>
            )}
            {friendStatus.status === "REQUEST_RECEIVED" && (
              <div className={styles.row}>
                <Button variant="primary" fullWidth onClick={acceptRequest}>
                  Aceptar
                </Button>
                <Button variant="secondary" fullWidth onClick={declineRequest}>
                  Declinar
                </Button>
              </div>
            )}
            {friendStatus.status === "FRIENDS" && (
              <>
                <span className={styles.friendsBadge}>✓ Amigos</span>
                <Button variant="ghost" fullWidth onClick={removeFriend}>
                  Eliminar amistad
                </Button>
              </>
            )}
            <button
              className={styles.reportButton}
              onClick={() => setShowReport(true)}
            >
              Reportar usuario
            </button>
          </div>
        )}

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Publicaciones</h2>
          {publications.length === 0 ? (
            <p className={styles.muted}>Sin publicaciones todavía.</p>
          ) : (
            <div className={styles.grid}>
              {publications.map((pub) => (
                <a
                  key={pub.id}
                  href={`/publication/${pub.id}`}
                  className={styles.pubCard}
                  onClick={(e) => {
                    if (onOpenPublication) {
                      e.preventDefault();
                      onOpenPublication(pub.id);
                    }
                  }}
                >
                  <PublicationCanvas
                    pixelData={pub.pixelData}
                    x1={pub.x1}
                    y1={pub.y1}
                    x2={pub.x2}
                    y2={pub.y2}
                    maxSize={150}
                  />
                  <div className={styles.pubInfo}>
                    {pub.title && (
                      <div className={styles.pubTitle}>{pub.title}</div>
                    )}
                    <div className={styles.pubMeta}>
                      👍 {pub.likes} · 👎 {pub.dislikes} · 💬 {pub.commentCount}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {!inModal && (
          <a href="/" className={styles.backLink}>
            ← Volver al lienzo
          </a>
        )}

        {showReport && (
          <ReportModal
            type="USER"
            targetNickname={profile.nickname}
            onClose={() => setShowReport(false)}
          />
        )}
      </div>
    </Wrapper>
  );
}
