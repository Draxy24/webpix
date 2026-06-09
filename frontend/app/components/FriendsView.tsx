"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/auth";
import styles from "./FriendsView.module.css";
import { API_URL } from "@/app/lib/api";

interface User {
  id: number;
  nickname: string;
  profilePic: string | null;
}
interface Friend extends User {
  friendshipId: number;
}
interface IncomingRequest {
  friendshipId: number;
  sender: User;
  createdAt: string;
}
interface OutgoingRequest {
  friendshipId: number;
  receiver: User;
  createdAt: string;
}

export default function FriendsView({
  onOpenProfile,
}: {
  onOpenProfile?: (nickname: string) => void;
}) {
  const { token } = useAuth();
  const [tab, setTab] = useState<"friends" | "incoming" | "outgoing">(
    "friends",
  );
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch(API_URL + "/friendships", { headers })
      .then((r) => r.json())
      .then(setFriends);
    fetch(API_URL + "/friendships/incoming", { headers })
      .then((r) => r.json())
      .then(setIncoming);
    fetch(API_URL + "/friendships/outgoing", { headers })
      .then((r) => r.json())
      .then(setOutgoing);
  }, [token]);

  const handleAccept = async (id: number) => {
    const res = await fetch(`${API_URL}/friendships/${id}/accept`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const request = incoming.find((r) => r.friendshipId === id);
      if (request) {
        setIncoming((prev) => prev.filter((r) => r.friendshipId !== id));
        setFriends((prev) => [
          ...prev,
          { ...request.sender, friendshipId: id },
        ]);
      }
    }
  };

  const handleDecline = async (id: number) => {
    const res = await fetch(`${API_URL}/friendships/${id}/decline`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok)
      setIncoming((prev) => prev.filter((r) => r.friendshipId !== id));
  };

  const handleCancel = async (id: number) => {
    const res = await fetch(`${API_URL}/friendships/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok)
      setOutgoing((prev) => prev.filter((r) => r.friendshipId !== id));
  };

  const handleRemoveFriend = async (id: number) => {
    const res = await fetch(`${API_URL}/friendships/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setFriends((prev) => prev.filter((f) => f.friendshipId !== id));
  };

  const card = (user: User, friendshipId: number, actions: React.ReactNode) => (
    <div key={friendshipId} className={styles.card}>
      <div
        className={styles.avatar}
        style={
          user.profilePic
            ? { backgroundImage: `url(${user.profilePic})` }
            : undefined
        }
      />
      <a
        href={`/profile/${user.nickname}`}
        className={styles.nameLink}
        onClick={(e) => {
          if (onOpenProfile) {
            e.preventDefault();
            onOpenProfile(user.nickname);
          }
        }}
      >
        {user.nickname}
      </a>
      <div className={styles.actions}>{actions}</div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button
          onClick={() => setTab("friends")}
          className={`${styles.tab} ${tab === "friends" ? styles.tabActive : ""}`}
        >
          Amigos ({friends.length})
        </button>
        <button
          onClick={() => setTab("incoming")}
          className={`${styles.tab} ${tab === "incoming" ? styles.tabActive : ""}`}
        >
          Recibidas ({incoming.length})
        </button>
        <button
          onClick={() => setTab("outgoing")}
          className={`${styles.tab} ${tab === "outgoing" ? styles.tabActive : ""}`}
        >
          Enviadas ({outgoing.length})
        </button>
      </div>

      {tab === "friends" && (
        <div className={styles.list}>
          {friends.length === 0 ? (
            <p className={styles.muted}>Aún no tienes amigos.</p>
          ) : (
            friends.map((f) =>
              card(
                f,
                f.friendshipId,
                <button
                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                  onClick={() => handleRemoveFriend(f.friendshipId)}
                  title="Eliminar amistad"
                >
                  ✕
                </button>,
              ),
            )
          )}
        </div>
      )}

      {tab === "incoming" && (
        <div className={styles.list}>
          {incoming.length === 0 ? (
            <p className={styles.muted}>No tienes solicitudes pendientes.</p>
          ) : (
            incoming.map((r) =>
              card(
                r.sender,
                r.friendshipId,
                <>
                  <button
                    className={`${styles.iconBtn} ${styles.iconBtnAccept}`}
                    onClick={() => handleAccept(r.friendshipId)}
                    title="Aceptar"
                  >
                    ✓
                  </button>
                  <button
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => handleDecline(r.friendshipId)}
                    title="Declinar"
                  >
                    ✕
                  </button>
                </>,
              ),
            )
          )}
        </div>
      )}

      {tab === "outgoing" && (
        <div className={styles.list}>
          {outgoing.length === 0 ? (
            <p className={styles.muted}>No has enviado solicitudes.</p>
          ) : (
            outgoing.map((r) =>
              card(
                r.receiver,
                r.friendshipId,
                <button
                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                  onClick={() => handleCancel(r.friendshipId)}
                  title="Cancelar solicitud"
                >
                  ✕
                </button>,
              ),
            )
          )}
        </div>
      )}
    </div>
  );
}
