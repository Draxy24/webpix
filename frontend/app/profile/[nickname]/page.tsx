"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../context/auth";
import PublicationCanvas from "../../components/PublicationCanvas";
import { COUNTRIES } from "../../lib/countries";
import Flag from "../../components/Flag";
import ReportModal from "../../components/ReportModal";

interface Profile {
  nickname: string;
  profilePic: string | null;
  country: string | null;
  createdAt: string;
  pixelCount: number;
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

export default function ProfilePage() {
  const params = useParams();
  const nickname = params.nickname as string;
  const { nickname: myNickname, token } = useAuth();
  const isOwnProfile = myNickname === nickname;
  const [countryInput, setCountryInput] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profilePicInput, setProfilePicInput] = useState("");
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
        setProfilePicInput(data.profilePic ?? "");
        setCountryInput(data.country ?? "");
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

  const handleSave = async () => {
    if (!token) return;
    const res = await fetch("http://localhost:3001/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        profilePic: profilePicInput,
        country: countryInput || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setProfile((prev) =>
        prev
          ? { ...prev, profilePic: data.profilePic, country: data.country }
          : prev,
      );
      setEditing(false);
    }
  };

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

  if (loading)
    return (
      <main style={{ textAlign: "center", marginTop: "40px" }}>
        Cargando...
      </main>
    );
  if (!profile)
    return (
      <main style={{ textAlign: "center", marginTop: "40px" }}>
        Perfil no encontrado
      </main>
    );

  return (
    <main style={{ maxWidth: "600px", margin: "40px auto", padding: "20px" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: "#eee",
            backgroundImage: profile.profilePic
              ? `url(${profile.profilePic})`
              : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: "2px solid #888",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <h1 style={{ margin: 0 }}>{profile.nickname}</h1>
          {profile.country && <Flag code={profile.country} />}
        </div>
        <div
          style={{
            display: "flex",
            gap: "24px",
            fontSize: "14px",
            color: "#aaa",
          }}
        >
          <span>
            <strong>{profile.pixelCount}</strong> píxeles pintados
          </span>
          <span>
            Miembro desde{" "}
            {new Date(profile.createdAt).toLocaleDateString("es-MX")}
          </span>
        </div>

        {!isOwnProfile && token && friendStatus && (
          <div style={{ marginTop: "8px" }}>
            {friendStatus.status === "NONE" && (
              <button
                onClick={sendRequest}
                style={{ padding: "8px 16px", cursor: "pointer" }}
              >
                Enviar solicitud de amistad
              </button>
            )}
            {friendStatus.status === "REQUEST_SENT" && (
              <span style={{ fontSize: "14px", color: "#aaa" }}>
                Solicitud enviada
              </span>
            )}
            {friendStatus.status === "REQUEST_RECEIVED" && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={acceptRequest}
                  style={{ padding: "8px 16px", cursor: "pointer" }}
                >
                  Aceptar solicitud
                </button>
                <button
                  onClick={declineRequest}
                  style={{ padding: "8px 16px", cursor: "pointer" }}
                >
                  Declinar
                </button>
              </div>
            )}
            {friendStatus.status === "FRIENDS" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#4a4" }}>✓ Amigos</span>
                <button
                  onClick={removeFriend}
                  style={{ padding: "8px 16px", cursor: "pointer" }}
                >
                  Eliminar amistad
                </button>
              </div>
            )}

            {!isOwnProfile && token && (
              <button
                onClick={() => setShowReport(true)}
                style={{
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "#c33",
                }}
              >
                Reportar usuario
              </button>
            )}
          </div>
        )}

        {isOwnProfile && (
          <div style={{ marginTop: "16px", width: "100%" }}>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                style={{ padding: "8px 16px", cursor: "pointer" }}
              >
                Editar perfil
              </button>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <input
                  type="text"
                  placeholder="URL de la imagen"
                  value={profilePicInput}
                  onChange={(e) => setProfilePicInput(e.target.value)}
                  style={{ padding: "8px" }}
                />
                <select
                  value={countryInput}
                  onChange={(e) => setCountryInput(e.target.value)}
                  style={{ padding: "8px" }}
                >
                  <option value="">Sin país</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleSave}
                    style={{ padding: "8px 16px", cursor: "pointer" }}
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setProfilePicInput(profile.profilePic ?? "");
                    }}
                    style={{ padding: "8px 16px", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ width: "100%", marginTop: "32px" }}>
          <h2 style={{ marginBottom: "12px" }}>Publicaciones</h2>
          {publications.length === 0 ? (
            <p style={{ color: "#aaa" }}>Sin publicaciones todavía.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: "16px",
              }}
            >
              {publications.map((pub) => (
                <a
                  key={pub.id}
                  href={`/publication/${pub.id}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    textDecoration: "none",
                    color: "inherit",
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
                  <div style={{ textAlign: "center", fontSize: "13px" }}>
                    {pub.title && (
                      <div style={{ fontWeight: "bold" }}>{pub.title}</div>
                    )}
                    <div style={{ color: "#aaa", fontSize: "12px" }}>
                      👍 {pub.likes} · 👎 {pub.dislikes} · 💬 {pub.commentCount}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <a href="/" style={{ marginTop: "20px", fontSize: "13px" }}>
          ← Volver al lienzo
        </a>

        {showReport && (
          <ReportModal
            type="USER"
            targetNickname={profile.nickname}
            onClose={() => setShowReport(false)}
          />
        )}
      </div>
    </main>
  );
}
