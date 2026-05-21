"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../context/auth";
import PublicationCanvas from "../../components/PublicationCanvas";

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  author: { nickname: string; profilePic: string | null };
  isMine: boolean;
}

interface PublicationDetail {
  id: number;
  title: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pixelData: Record<string, string>;
  createdAt: string;
  author: { nickname: string; profilePic: string | null };
  likes: number;
  dislikes: number;
  myReaction: "LIKE" | "DISLIKE" | null;
  comments: Comment[];
}

export default function PublicationPage() {
  const params = useParams();
  const id = params.id as string;
  const { token, nickname: myNickname } = useAuth();

  const [pub, setPub] = useState<PublicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchPublication = useCallback(async () => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`http://localhost:3001/publications/${id}`, {
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      setPub(data);
    }
    setLoading(false);
  }, [id, token]);

  useEffect(() => {
    fetchPublication();
  }, [fetchPublication]);

  const handleReact = async (type: "LIKE" | "DISLIKE") => {
    if (!token || !pub) return;
    const res = await fetch(
      `http://localhost:3001/publications/${pub.id}/react`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      },
    );
    if (res.ok) fetchPublication();
  };

  const handleAddComment = async () => {
    if (!token || !pub || !newComment.trim()) return;
    setSubmittingComment(true);
    const res = await fetch(
      `http://localhost:3001/publications/${pub.id}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newComment }),
      },
    );
    if (res.ok) {
      const comment = await res.json();
      setPub((prev) =>
        prev ? { ...prev, comments: [...prev.comments, comment] } : prev,
      );
      setNewComment("");
    }
    setSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!token) return;
    const res = await fetch(
      `http://localhost:3001/publications/comments/${commentId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.ok) {
      setPub((prev) =>
        prev
          ? {
              ...prev,
              comments: prev.comments.filter((c) => c.id !== commentId),
            }
          : prev,
      );
    }
  };

  const handleDeletePublication = async () => {
    if (!token || !pub) return;
    if (!confirm("¿Estás seguro de eliminar esta publicación?")) return;
    const res = await fetch(`http://localhost:3001/publications/${pub.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) window.location.href = `/profile/${pub.author.nickname}`;
  };

  if (loading)
    return (
      <main style={{ textAlign: "center", marginTop: "40px" }}>
        Cargando...
      </main>
    );
  if (!pub)
    return (
      <main style={{ textAlign: "center", marginTop: "40px" }}>
        Publicación no encontrada
      </main>
    );

  const isMine = myNickname === pub.author.nickname;

  return (
    <main style={{ maxWidth: "700px", margin: "40px auto", padding: "20px" }}>
      <a href="/" style={{ fontSize: "13px" }}>
        ← Volver al lienzo
      </a>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          marginTop: "16px",
        }}
      >
        {pub.title && <h1 style={{ margin: 0 }}>{pub.title}</h1>}
        <PublicationCanvas
          pixelData={pub.pixelData}
          x1={pub.x1}
          y1={pub.y1}
          x2={pub.x2}
          y2={pub.y2}
          maxSize={500}
        />
        <div style={{ fontSize: "14px", color: "#aaa" }}>
          Por{" "}
          <a href={`/profile/${pub.author.nickname}`}>{pub.author.nickname}</a>
          {" · "}
          {new Date(pub.createdAt).toLocaleDateString("es-MX")}
        </div>

        {token ? (
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => handleReact("LIKE")}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                background: pub.myReaction === "LIKE" ? "#4a4" : "#fff",
                color: pub.myReaction === "LIKE" ? "#fff" : "#000",
                border: "1px solid #4a4",
              }}
            >
              👍 {pub.likes}
            </button>
            <button
              onClick={() => handleReact("DISLIKE")}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                background: pub.myReaction === "DISLIKE" ? "#a44" : "#fff",
                color: pub.myReaction === "DISLIKE" ? "#fff" : "#000",
                border: "1px solid #a44",
              }}
            >
              👎 {pub.dislikes}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "12px", color: "#aaa" }}>
            <span>👍 {pub.likes}</span>
            <span>👎 {pub.dislikes}</span>
          </div>
        )}

        {isMine && (
          <button
            onClick={handleDeletePublication}
            style={{ padding: "8px 16px", cursor: "pointer", color: "#f88" }}
          >
            Eliminar publicación
          </button>
        )}
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2 style={{ marginBottom: "12px" }}>
          Comentarios ({pub.comments.length})
        </h2>

        {token && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="Escribe un comentario (máx 100)"
              maxLength={100}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              style={{ flex: 1, padding: "8px" }}
            />
            <button
              onClick={handleAddComment}
              disabled={submittingComment || !newComment.trim()}
              style={{ padding: "8px 16px", cursor: "pointer" }}
            >
              Enviar
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {pub.comments.length === 0 ? (
            <p style={{ color: "#aaa" }}>No hay comentarios todavía.</p>
          ) : (
            pub.comments.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  border: "1px solid #555",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "#eee",
                    backgroundImage: c.author.profilePic
                      ? `url(${c.author.profilePic})`
                      : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <a
                    href={`/profile/${c.author.nickname}`}
                    style={{ fontWeight: "bold", fontSize: "13px" }}
                  >
                    {c.author.nickname}
                  </a>
                  <div style={{ fontSize: "14px", marginTop: "4px" }}>
                    {c.content}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#888",
                      marginTop: "4px",
                    }}
                  >
                    {new Date(c.createdAt).toLocaleString("es-MX")}
                  </div>
                </div>
                {c.isMine && (
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    style={{ cursor: "pointer", fontSize: "12px" }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
