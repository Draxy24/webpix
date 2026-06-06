"use client";

import { useAuth } from "../context/auth";
import PublicationCanvas from "./PublicationCanvas";
import ReportModal from "./ReportModal";
import Button from "./Button";
import styles from "./PublicationView.module.css";
import { useEffect, useState, useCallback, type ElementType } from "react";

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

export default function PublicationView({
  id,
  onOpenProfile,
}: {
  id: string;
  onOpenProfile?: (nickname: string) => void;
}) {
  const { token, nickname: myNickname } = useAuth();
  const inModal = !!onOpenProfile;
  const [pub, setPub] = useState<PublicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showReportPub, setShowReportPub] = useState(false);
  const [reportCommentId, setReportCommentId] = useState<number | null>(null);

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
    if (res.ok) {
      if (inModal) {
        onOpenProfile?.(pub.author.nickname);
      } else {
        window.location.href = `/profile/${pub.author.nickname}`;
      }
    }
  };

  if (loading) return <div className={styles.centered}>Cargando...</div>;
  if (!pub)
    return <div className={styles.centered}>Publicación no encontrada</div>;

  const isMine = myNickname === pub.author.nickname;
  const Wrapper: ElementType = inModal ? "div" : "main";

  return (
    <Wrapper className={styles.main}>
      {!inModal && (
        <a href="/" className={styles.backLink}>
          ← Volver al lienzo
        </a>
      )}

      <div className={styles.header}>
        {pub.title && <h1 className={styles.title}>{pub.title}</h1>}
        <div className={styles.canvasWrap}>
          <PublicationCanvas
            pixelData={pub.pixelData}
            x1={pub.x1}
            y1={pub.y1}
            x2={pub.x2}
            y2={pub.y2}
            maxSize={500}
          />
        </div>
        <div className={styles.meta}>
          Por{" "}
          <a
            href={`/profile/${pub.author.nickname}`}
            onClick={(e) => {
              if (onOpenProfile) {
                e.preventDefault();
                onOpenProfile(pub.author.nickname);
              }
            }}
            className={styles.authorLink}
          >
            {pub.author.nickname}
          </a>
          {" · "}
          {new Date(pub.createdAt).toLocaleDateString("es-MX")}
        </div>

        {token ? (
          <div className={styles.reactions}>
            <button
              onClick={() => handleReact("LIKE")}
              className={`${styles.reactBtn} ${pub.myReaction === "LIKE" ? styles.likeActive : ""}`}
            >
              👍 {pub.likes}
            </button>
            <button
              onClick={() => handleReact("DISLIKE")}
              className={`${styles.reactBtn} ${pub.myReaction === "DISLIKE" ? styles.dislikeActive : ""}`}
            >
              👎 {pub.dislikes}
            </button>
          </div>
        ) : (
          <div className={styles.reactionsStatic}>
            <span>👍 {pub.likes}</span>
            <span>👎 {pub.dislikes}</span>
          </div>
        )}

        {isMine && (
          <Button variant="danger" size="sm" onClick={handleDeletePublication}>
            Eliminar publicación
          </Button>
        )}
        {token && !isMine && (
          <button
            className={styles.reportButton}
            onClick={() => setShowReportPub(true)}
          >
            Reportar publicación
          </button>
        )}
      </div>

      <div className={styles.commentsSection}>
        <h2 className={styles.commentsTitle}>
          Comentarios ({pub.comments.length})
        </h2>

        {token && (
          <div className={styles.commentForm}>
            <input
              type="text"
              placeholder="Escribe un comentario (máx 100)"
              maxLength={100}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className={styles.commentInput}
            />
            <Button
              onClick={handleAddComment}
              disabled={submittingComment || !newComment.trim()}
            >
              Enviar
            </Button>
          </div>
        )}

        <div className={styles.commentList}>
          {pub.comments.length === 0 ? (
            <p className={styles.muted}>No hay comentarios todavía.</p>
          ) : (
            pub.comments.map((c) => (
              <div key={c.id} className={styles.comment}>
                <div
                  className={styles.commentAvatar}
                  style={
                    c.author.profilePic
                      ? { backgroundImage: `url(${c.author.profilePic})` }
                      : undefined
                  }
                />
                <div className={styles.commentBody}>
                  <a
                    href={`/profile/${c.author.nickname}`}
                    className={styles.commentAuthor}
                    onClick={(e) => {
                      if (onOpenProfile) {
                        e.preventDefault();
                        onOpenProfile(c.author.nickname);
                      }
                    }}
                  >
                    {c.author.nickname}
                  </a>
                  <div className={styles.commentContent}>{c.content}</div>
                  <div className={styles.commentDate}>
                    {new Date(c.createdAt).toLocaleString("es-MX")}
                  </div>
                </div>
                {c.isMine && (
                  <button
                    className={styles.commentAction}
                    onClick={() => handleDeleteComment(c.id)}
                  >
                    Eliminar
                  </button>
                )}
                {token && !c.isMine && (
                  <button
                    className={styles.commentAction}
                    onClick={() => setReportCommentId(c.id)}
                  >
                    Reportar
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {showReportPub && (
        <ReportModal
          type="PUBLICATION"
          publicationId={pub.id}
          onClose={() => setShowReportPub(false)}
        />
      )}
      {reportCommentId !== null && (
        <ReportModal
          type="COMMENT"
          commentId={reportCommentId}
          onClose={() => setReportCommentId(null)}
        />
      )}
    </Wrapper>
  );
}
