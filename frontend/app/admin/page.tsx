"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth";

type Report = {
  id: number;
  type: "USER" | "PUBLICATION" | "COMMENT" | "BUG";
  reason: string;
  details: string | null;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reporterNickname: string;
  targetUserId: number | null;
  targetNickname: string | null;
  publicationId: number | null;
  commentId: number | null;
  contentAuthorId: number | null;
  contentAuthorNickname: string | null;
  contentPreview: string | null;
};

type LogEntry = {
  id: number;
  action: string;
  moderator: string;
  targetNickname: string | null;
  details: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  BAN_TEMP: "Baneo temporal",
  BAN_PERMANENT: "Baneo permanente",
  MODIFY_BAN: "Modificó baneo",
  UNBAN: "Quitó baneo",
  DELETE_PUBLICATION: "Borró publicación",
  DELETE_COMMENT: "Borró comentario",
  RESOLVE_REPORT: "Resolvió reporte",
  DISMISS_REPORT: "Descartó reporte",
};

const TYPE_LABELS: Record<string, string> = {
  USER: "Usuario",
  PUBLICATION: "Publicación",
  COMMENT: "Comentario",
  BUG: "Bug",
};
const TYPE_COLORS: Record<string, string> = {
  USER: "#c33",
  PUBLICATION: "#a60",
  COMMENT: "#36c",
  BUG: "#693",
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  RESOLVED: "Resuelto",
  DISMISSED: "Descartado",
};

function BanModal({
  target,
  token,
  onClose,
  onDone,
}: {
  target: { userId: number; nickname: string };
  token: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [permanent, setPermanent] = useState(false);
  const [days, setDays] = useState(3);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleBan = async () => {
    if (!reason.trim()) {
      setError("Debes indicar un motivo");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3001/moderation/ban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: target.userId,
          durationDays: permanent ? null : days,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error al banear");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          color: "#000",
          padding: "20px",
          borderRadius: "8px",
          width: "340px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <h3 style={{ margin: 0 }}>Banear a {target.nickname}</h3>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
          }}
        >
          <input
            type="checkbox"
            checked={permanent}
            onChange={(e) => setPermanent(e.target.checked)}
          />
          Baneo permanente
        </label>
        {!permanent && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "13px" }}>Duración (días)</label>
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) =>
                setDays(Math.max(1, parseInt(e.target.value) || 1))
              }
              style={{ padding: "8px", fontSize: "14px" }}
            />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "13px" }}>Motivo</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Contenido NSFW reiterado"
            style={{ padding: "8px", fontSize: "14px" }}
          />
        </div>
        {error && (
          <p style={{ color: "red", fontSize: "13px", margin: 0 }}>{error}</p>
        )}
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 12px", cursor: "pointer", flex: 1 }}
          >
            Cancelar
          </button>
          <button
            onClick={handleBan}
            disabled={submitting}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              flex: 1,
              background: "#c33",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
            }}
          >
            {submitting ? "Baneando..." : "Banear"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  const [tab, setTab] = useState<"reports" | "log">("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [typeFilter, setTypeFilter] = useState("");
  const [loadingReports, setLoadingReports] = useState(false);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  const [banTarget, setBanTarget] = useState<{
    userId: number;
    nickname: string;
  } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    fetch("http://localhost:3001/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.isAdmin) {
          router.push("/");
          return;
        }
        setAuthorized(true);
        setChecking(false);
      });
  }, [token, loading, router]);

  const loadReports = useCallback(async () => {
    if (!token) return;
    setLoadingReports(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    const res = await fetch(
      `http://localhost:3001/moderation/reports?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await res.json();
    setReports(data);
    setLoadingReports(false);
  }, [token, statusFilter, typeFilter]);

  const loadLog = useCallback(async () => {
    if (!token) return;
    setLoadingLog(true);
    const res = await fetch("http://localhost:3001/moderation/log", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setLog(data);
    setLoadingLog(false);
  }, [token]);

  useEffect(() => {
    if (authorized && tab === "reports") loadReports();
  }, [authorized, tab, loadReports]);

  useEffect(() => {
    if (authorized && tab === "log") loadLog();
  }, [authorized, tab, loadLog]);

  const action = async (url: string, method: string) => {
    await fetch(`http://localhost:3001${url}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    loadReports();
  };

  if (loading || checking) {
    return (
      <main style={{ textAlign: "center", marginTop: "80px" }}>
        Cargando...
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "800px", margin: "40px auto", padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>Panel de moderación</h1>
        <a href="/" style={{ fontSize: "13px" }}>
          ← Volver al lienzo
        </a>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "20px",
          borderBottom: "1px solid #555",
        }}
      >
        <button
          onClick={() => setTab("reports")}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            background: "none",
            border: "none",
            color: tab === "reports" ? "#fff" : "#888",
            borderBottom:
              tab === "reports" ? "2px solid #fff" : "2px solid transparent",
            fontSize: "14px",
          }}
        >
          Reportes
        </button>
        <button
          onClick={() => setTab("log")}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            background: "none",
            border: "none",
            color: tab === "log" ? "#fff" : "#888",
            borderBottom:
              tab === "log" ? "2px solid #fff" : "2px solid transparent",
            fontSize: "14px",
          }}
        >
          Registro
        </button>
      </div>

      {tab === "reports" && (
        <>
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "20px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <label style={{ fontSize: "12px", color: "#aaa" }}>Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: "6px", fontSize: "14px" }}
              >
                <option value="PENDING">Pendientes</option>
                <option value="RESOLVED">Resueltos</option>
                <option value="DISMISSED">Descartados</option>
                <option value="">Todos</option>
              </select>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <label style={{ fontSize: "12px", color: "#aaa" }}>Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ padding: "6px", fontSize: "14px" }}
              >
                <option value="">Todos</option>
                <option value="USER">Usuarios</option>
                <option value="PUBLICATION">Publicaciones</option>
                <option value="COMMENT">Comentarios</option>
                <option value="BUG">Bugs</option>
              </select>
            </div>
          </div>

          <div
            style={{
              marginTop: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {loadingReports ? (
              <p style={{ color: "#aaa" }}>Cargando reportes...</p>
            ) : reports.length === 0 ? (
              <p style={{ color: "#aaa" }}>
                No hay reportes con estos filtros.
              </p>
            ) : (
              reports.map((r) => {
                const responsible =
                  r.type === "USER" && r.targetUserId
                    ? {
                        userId: r.targetUserId,
                        nickname: r.targetNickname ?? "?",
                      }
                    : r.contentAuthorId
                      ? {
                          userId: r.contentAuthorId,
                          nickname: r.contentAuthorNickname ?? "?",
                        }
                      : null;

                return (
                  <div
                    key={r.id}
                    style={{
                      border: "1px solid #555",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          background: TYPE_COLORS[r.type],
                          color: "#fff",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                        }}
                      >
                        {TYPE_LABELS[r.type]}
                      </span>
                      <span style={{ fontSize: "12px", color: "#aaa" }}>
                        {STATUS_LABELS[r.status]} ·{" "}
                        {new Date(r.createdAt).toLocaleString("es-MX")}
                      </span>
                    </div>

                    <div style={{ fontSize: "14px" }}>
                      <div>
                        <strong>Reportado por:</strong> {r.reporterNickname}
                      </div>
                      {r.type === "USER" && (
                        <div>
                          <strong>Usuario reportado:</strong>{" "}
                          {r.targetNickname ?? "?"}
                        </div>
                      )}
                      {(r.type === "PUBLICATION" || r.type === "COMMENT") && (
                        <>
                          <div>
                            <strong>Autor del contenido:</strong>{" "}
                            {r.contentAuthorNickname ?? "?"}
                          </div>
                          <div
                            style={{
                              color: "#aaa",
                              fontStyle: "italic",
                              marginTop: "2px",
                            }}
                          >
                            “{r.contentPreview}”
                          </div>
                        </>
                      )}
                      <div style={{ marginTop: "4px" }}>
                        <strong>Motivo:</strong> {r.reason}
                      </div>
                      {r.details && (
                        <div
                          style={{
                            marginTop: "4px",
                            whiteSpace: "pre-wrap",
                            background: "#2a2a2a",
                            padding: "8px",
                            borderRadius: "4px",
                            fontSize: "13px",
                          }}
                        >
                          {r.details}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginTop: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      {r.type === "PUBLICATION" && r.publicationId && (
                        <>
                          <a
                            href={`/publication/${r.publicationId}`}
                            target="_blank"
                            style={{
                              padding: "6px 10px",
                              fontSize: "13px",
                              border: "1px solid #888",
                              borderRadius: "4px",
                              textDecoration: "none",
                              color: "inherit",
                            }}
                          >
                            Ver publicación
                          </a>
                          <button
                            onClick={() => {
                              if (confirm("¿Borrar esta publicación?"))
                                action(
                                  `/moderation/publication/${r.publicationId}`,
                                  "DELETE",
                                );
                            }}
                            style={btn("#a60")}
                          >
                            Borrar publicación
                          </button>
                        </>
                      )}
                      {r.type === "COMMENT" && r.commentId && (
                        <button
                          onClick={() => {
                            if (confirm("¿Borrar este comentario?"))
                              action(
                                `/moderation/comment/${r.commentId}`,
                                "DELETE",
                              );
                          }}
                          style={btn("#a60")}
                        >
                          Borrar comentario
                        </button>
                      )}
                      {responsible && (
                        <button
                          onClick={() => setBanTarget(responsible)}
                          style={btn("#c33")}
                        >
                          Banear a {responsible.nickname}
                        </button>
                      )}
                      {r.status === "PENDING" && (
                        <>
                          <button
                            onClick={() =>
                              action(
                                `/moderation/reports/${r.id}/resolve`,
                                "PATCH",
                              )
                            }
                            style={btn("#4a4")}
                          >
                            Resolver
                          </button>
                          <button
                            onClick={() =>
                              action(
                                `/moderation/reports/${r.id}/dismiss`,
                                "PATCH",
                              )
                            }
                            style={btn("#666")}
                          >
                            Descartar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {tab === "log" && (
        <div
          style={{
            marginTop: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {loadingLog ? (
            <p style={{ color: "#aaa" }}>Cargando registro...</p>
          ) : log.length === 0 ? (
            <p style={{ color: "#aaa" }}>
              No hay acciones registradas todavía.
            </p>
          ) : (
            log.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: "1px solid #555",
                  borderRadius: "6px",
                  padding: "12px",
                  fontSize: "14px",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <strong>{ACTION_LABELS[entry.action] ?? entry.action}</strong>
                  <span style={{ fontSize: "12px", color: "#aaa" }}>
                    {new Date(entry.createdAt).toLocaleString("es-MX")}
                  </span>
                </div>
                <div style={{ color: "#aaa", marginTop: "4px" }}>
                  Por <strong>{entry.moderator}</strong>
                  {entry.targetNickname && (
                    <>
                      {" "}
                      · sobre <strong>{entry.targetNickname}</strong>
                    </>
                  )}
                  {entry.details && <> · {entry.details}</>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {banTarget && (
        <BanModal
          target={banTarget}
          token={token}
          onClose={() => setBanTarget(null)}
          onDone={() => {
            setBanTarget(null);
            loadReports();
          }}
        />
      )}
    </main>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    padding: "6px 10px",
    fontSize: "13px",
    cursor: "pointer",
    background: color,
    color: "#fff",
    border: "none",
    borderRadius: "4px",
  };
}
