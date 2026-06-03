"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/auth";
import Button from "./Button";
import styles from "./PrivateSpacesView.module.css";

type Space = {
  id: number;
  name: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  accessMode: "OWNER_ONLY" | "FRIENDS" | "SPECIFIC";
  purchaseType: "MONTHLY" | "PERMANENT";
  expiresAt: string | null;
  active: boolean;
  pixels: number;
  members: string[];
};

const ACCESS_LABELS: Record<Space["accessMode"], string> = {
  OWNER_ONLY: "Solo yo",
  FRIENDS: "Amigos",
  SPECIFIC: "Específicos",
};

export default function PrivateSpacesView() {
  const { token } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/private-spaces/mine", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSpaces(Array.isArray(data) ? data : []);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className={styles.muted}>Cargando tus espacios...</p>;
  }
  if (spaces.length === 0) {
    return (
      <p className={styles.muted}>
        Aún no tienes espacios privados. Usa la herramienta de espacio privado
        en el lienzo para comprar uno.
      </p>
    );
  }

  return (
    <div className={styles.list}>
      {spaces.map((sp) => (
        <SpaceCard key={sp.id} space={sp} token={token!} onChanged={load} />
      ))}
    </div>
  );
}

function SpaceCard({
  space,
  token,
  onChanged,
}: {
  space: Space;
  token: string;
  onChanged: () => void;
}) {
  const [memberInput, setMemberInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `http://localhost:3001/private-spaces/${space.id}/access`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || "No se pudo actualizar");
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const changeMode = (mode: Space["accessMode"]) => {
    if (mode === space.accessMode) return;
    patch({ accessMode: mode });
  };

  const addMember = async () => {
    const nick = memberInput.trim();
    if (!nick) return;
    await patch({ addNicknames: [nick] });
    setMemberInput("");
  };

  const removeMember = (nick: string) => {
    patch({ removeNicknames: [nick] });
  };

  const release = async () => {
    if (
      !window.confirm(
        "¿Liberar este espacio? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `http://localhost:3001/private-spaces/${space.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || "No se pudo liberar");
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const width = space.x2 - space.x1 + 1;
  const height = space.y2 - space.y1 + 1;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.title}>
          {space.name || `Espacio #${space.id}`}
        </span>
        <div className={styles.badges}>
          <span className={styles.badge}>
            {space.purchaseType === "MONTHLY" ? "Mensual" : "Permanente"}
          </span>
          {!space.active && (
            <span className={`${styles.badge} ${styles.badgeExpired}`}>
              Expirado
            </span>
          )}
        </div>
      </div>

      <div className={styles.meta}>
        Posición ({space.x1}, {space.y1}) · {width}×{height} ({space.pixels} px)
      </div>
      {space.purchaseType === "MONTHLY" && space.expiresAt && (
        <div className={styles.meta}>
          {space.active ? "Renueva el " : "Expiró el "}
          {new Date(space.expiresAt).toLocaleDateString("es-MX")}
        </div>
      )}

      <div className={styles.modeRow}>
        {(["OWNER_ONLY", "FRIENDS", "SPECIFIC"] as Space["accessMode"][]).map(
          (mode) => (
            <button
              key={mode}
              className={`${styles.modeBtn} ${space.accessMode === mode ? styles.modeBtnActive : ""}`}
              onClick={() => changeMode(mode)}
              disabled={busy}
            >
              {ACCESS_LABELS[mode]}
            </button>
          ),
        )}
      </div>

      {space.accessMode === "SPECIFIC" && (
        <div className={styles.membersBlock}>
          {space.members.length > 0 ? (
            <div className={styles.members}>
              {space.members.map((m) => (
                <span key={m} className={styles.memberChip}>
                  {m}
                  <button
                    className={styles.chipRemove}
                    onClick={() => removeMember(m)}
                    disabled={busy}
                    aria-label={`Quitar a ${m}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className={styles.muted}>Sin usuarios autorizados aún.</span>
          )}
          <div className={styles.addRow}>
            <input
              type="text"
              className={styles.input}
              placeholder="Agregar por nickname"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addMember();
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={addMember}
              disabled={busy || !memberInput.trim()}
            >
              Agregar
            </Button>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <Button
        variant="danger"
        size="sm"
        fullWidth
        onClick={release}
        disabled={busy}
      >
        Liberar espacio
      </Button>
    </div>
  );
}
