"use client";

import { useAuth } from "../context/auth";
import PublicationCanvas from "./PublicationCanvas";
import ReportModal from "./ReportModal";
import Button from "./Button";
import styles from "./PublicationView.module.css";
import { useEffect, useState, useCallback, type ElementType } from "react";
import { useTranslation } from "react-i18next";
import { API_URL } from "@/app/lib/api";
import { useNotify } from "./NotificationProvider";

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
  const { t, i18n } = useTranslation();
  const { confirm } = useNotify();
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
    const res = await fetch(`${API_URL}/publications/${id}`, { headers });
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
    const res = await fetch(`${API_URL}/publications/${pub.id}/react`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type }),
    });
    if (res.ok) fetchPublication();
  };

  const handleAddComment = async () => {
    if (!token || !pub || !newComment.trim()) return;
    setSubmittingComment(true);
    const res = await fetch(`${API_URL}/publications/${pub.id}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: newComment }),
    });
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
    const res = await fetch(`${API_URL}/publications/comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
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
    if (
      !(await confirm({
        message: t("publication.confirmDelete"),
        danger: true,
      }))
    )
      return;
    const res = await fetch(`${API_URL}/publications/${pub.id}`, {
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

  if (loading)
    return <div className={styles.centered}>{t("common.loading")}</div>;
  if (!pub)
    return <div className={styles.centered}>{t("publication.notFound")}</div>;

  const isMine = myNickname === pub.author.nickname;
  const Wrapper: ElementType = inModal ? "div" : "main";

  return (
    <Wrapper className={styles.main}>
      {!inModal && (
        <a href="/" className={styles.backLink}>
          ← {t("profile.backToCanvas")}
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
          {t("publication.by")}{" "}
          <a
            href={`/profile/${pub.author.nickname}`}
            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
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
          {new Date(pub.createdAt).toLocaleDateString(i18n.language)}
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
            {t("publication.delete")}
          </Button>
        )}

        {token && !isMine && (
          <button
            className={styles.reportButton}
            onClick={() => setShowReportPub(true)}
          >
            {t("publication.report")}
          </button>
        )}
      </div>

      <div className={styles.commentsSection}>
        <h2 className={styles.commentsTitle}>
          {t("publication.comments", { n: pub.comments.length })}
        </h2>

        {token && (
          <div className={styles.commentForm}>
            <input
              type="text"
              placeholder={t("publication.commentPlaceholder")}
              maxLength={100}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className={styles.commentInput}
            />
            <Button
              onClick={handleAddComment}
              disabled={submittingComment || !newComment.trim()}
            >
              {t("publication.send")}
            </Button>
          </div>
        )}

        <div className={styles.commentList}>
          {pub.comments.length === 0 ? (
            <p className={styles.muted}>{t("publication.noComments")}</p>
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
                    onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
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
                    {new Date(c.createdAt).toLocaleString(i18n.language)}
                  </div>
                </div>

                {c.isMine && (
                  <button
                    className={styles.commentAction}
                    onClick={() => handleDeleteComment(c.id)}
                  >
                    {t("publication.deleteComment")}
                  </button>
                )}

                {token && !c.isMine && (
                  <button
                    className={styles.commentAction}
                    onClick={() => setReportCommentId(c.id)}
                  >
                    {t("publication.reportComment")}
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
