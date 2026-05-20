"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../context/auth";

interface Profile {
  nickname: string;
  profilePic: string | null;
  createdAt: string;
  pixelCount: number;
}

export default function ProfilePage() {
  const params = useParams();
  const nickname = params.nickname as string;
  const { nickname: myNickname, token } = useAuth();
  const isOwnProfile = myNickname === nickname;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profilePicInput, setProfilePicInput] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://localhost:3001/users/${nickname}`);
        if (!res.ok) throw new Error("Perfil no encontrado");
        const data = await res.json();
        setProfile(data);
        setProfilePicInput(data.profilePic ?? "");
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [nickname]);

  const handleSave = async () => {
    if (!token) return;
    const res = await fetch("http://localhost:3001/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ profilePic: profilePicInput }),
    });

    if (res.ok) {
      const data = await res.json();
      setProfile((prev) =>
        prev ? { ...prev, profilePic: data.profilePic } : prev,
      );
      setEditing(false);
    }
  };

  if (loading) {
    return (
      <main style={{ textAlign: "center", marginTop: "40px" }}>
        Cargando...
      </main>
    );
  }

  if (!profile) {
    return (
      <main style={{ textAlign: "center", marginTop: "40px" }}>
        Perfil no encontrado
      </main>
    );
  }

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
        <h1 style={{ margin: 0 }}>{profile.nickname}</h1>
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

        {isOwnProfile && (
          <div style={{ marginTop: "16px", width: "100%" }}>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                style={{ padding: "8px 16px", cursor: "pointer" }}
              >
                Editar foto de perfil
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

        <a href="/" style={{ marginTop: "20px", fontSize: "13px" }}>
          ← Volver al lienzo
        </a>
      </div>
    </main>
  );
}
