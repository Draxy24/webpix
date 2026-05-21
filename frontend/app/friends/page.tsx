"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/auth";
import { useRouter } from "next/navigation";

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

export default function FriendsPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"friends" | "incoming" | "outgoing">(
    "friends",
  );
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    fetch("http://localhost:3001/friendships", { headers })
      .then((r) => r.json())
      .then(setFriends);
    fetch("http://localhost:3001/friendships/incoming", { headers })
      .then((r) => r.json())
      .then(setIncoming);
    fetch("http://localhost:3001/friendships/outgoing", { headers })
      .then((r) => r.json())
      .then(setOutgoing);
  }, [token, router, loading]);

  const handleAccept = async (id: number) => {
    const res = await fetch(`http://localhost:3001/friendships/${id}/accept`, {
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
    const res = await fetch(`http://localhost:3001/friendships/${id}/decline`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok)
      setIncoming((prev) => prev.filter((r) => r.friendshipId !== id));
  };

  const handleCancel = async (id: number) => {
    const res = await fetch(`http://localhost:3001/friendships/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok)
      setOutgoing((prev) => prev.filter((r) => r.friendshipId !== id));
  };

  const handleRemoveFriend = async (id: number) => {
    const res = await fetch(`http://localhost:3001/friendships/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setFriends((prev) => prev.filter((f) => f.friendshipId !== id));
  };

  const tabButton = (key: typeof tab, label: string, count: number) => (
    <button
      onClick={() => setTab(key)}
      style={{
        padding: "8px 16px",
        cursor: "pointer",
        background: tab === key ? "#000" : "#fff",
        color: tab === key ? "#fff" : "#000",
        border: "1px solid #000",
      }}
    >
      {label} ({count})
    </button>
  );

  const userCard = (user: User, actions: React.ReactNode, key: number) => (
    <div
      key={key}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px",
        border: "1px solid #555",
        borderRadius: "8px",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "#eee",
          backgroundImage: user.profilePic ? `url(${user.profilePic})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <a href={`/profile/${user.nickname}`} style={{ flex: 1 }}>
        {user.nickname}
      </a>
      {actions}
    </div>
  );

  return (
    <main style={{ maxWidth: "600px", margin: "40px auto", padding: "20px" }}>
      <h1>Amigos</h1>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {tabButton("friends", "Mis amigos", friends.length)}
        {tabButton("incoming", "Recibidas", incoming.length)}
        {tabButton("outgoing", "Enviadas", outgoing.length)}
      </div>

      {tab === "friends" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {friends.length === 0 ? (
            <p>Aún no tienes amigos.</p>
          ) : (
            friends.map((f) =>
              userCard(
                f,
                <button
                  onClick={() => handleRemoveFriend(f.friendshipId)}
                  style={{ cursor: "pointer" }}
                >
                  Eliminar
                </button>,
                f.friendshipId,
              ),
            )
          )}
        </div>
      )}

      {tab === "incoming" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {incoming.length === 0 ? (
            <p>No tienes solicitudes pendientes.</p>
          ) : (
            incoming.map((r) =>
              userCard(
                r.sender,
                <>
                  <button
                    onClick={() => handleAccept(r.friendshipId)}
                    style={{ cursor: "pointer" }}
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => handleDecline(r.friendshipId)}
                    style={{ cursor: "pointer" }}
                  >
                    Declinar
                  </button>
                </>,
                r.friendshipId,
              ),
            )
          )}
        </div>
      )}

      {tab === "outgoing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {outgoing.length === 0 ? (
            <p>No has enviado solicitudes.</p>
          ) : (
            outgoing.map((r) =>
              userCard(
                r.receiver,
                <button
                  onClick={() => handleCancel(r.friendshipId)}
                  style={{ cursor: "pointer" }}
                >
                  Cancelar
                </button>,
                r.friendshipId,
              ),
            )
          )}
        </div>
      )}

      <a
        href="/"
        style={{ display: "block", marginTop: "20px", fontSize: "13px" }}
      >
        ← Volver al lienzo
      </a>
    </main>
  );
}
