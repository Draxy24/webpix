"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/auth";
import styles from "./ShopView.module.css";

type ShopItem = {
  id: number;
  key: string;
  type: "TITLE" | "BADGE" | "FRAME" | "BACKGROUND";
  name: string;
  description: string | null;
  rarity: "COMMON" | "RARE" | "PREMIUM" | null;
  priceBits: number;
  data: {
    icon?: string;
    color?: string;
    ring?: string;
    background?: string;
  } | null;
  owned: boolean;
};

type ShopData = { bits: number; items: ShopItem[] };

const RARITY_ORDER: ("COMMON" | "RARE" | "PREMIUM")[] = [
  "COMMON",
  "RARE",
  "PREMIUM",
];
const RARITY_LABEL: Record<string, string> = {
  COMMON: "Comunes",
  RARE: "Raros",
  PREMIUM: "Premium",
};

function badgeIcon(icon?: string) {
  if (icon === "crown") return "👑";
  if (icon === "star") return "⭐";
  return "🏅";
}

export default function ShopView() {
  const { token } = useAuth();
  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/shop", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(await res.json());
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const buy = async (item: ShopItem) => {
    if (!token || busyId) return;
    setBusyId(item.id);
    setMessage(null);
    try {
      const res = await fetch("http://localhost:3001/shop/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cosmeticId: item.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        setMessage(result.message || "No se pudo completar la compra");
      } else {
        setMessage(`¡Compraste "${item.name}"!`);
        await load();
      }
    } catch {
      setMessage("Error de conexión");
    } finally {
      setBusyId(null);
    }
  };

  if (!token)
    return (
      <div className={styles.empty}>
        Inicia sesión para comprar en la tienda.
      </div>
    );
  if (loading) return <div className={styles.empty}>Cargando tienda...</div>;
  if (!data || data.items.length === 0)
    return <div className={styles.empty}>La tienda está vacía por ahora.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.balance}>
        <span className={styles.balanceLabel}>Tu saldo</span>
        <span className={styles.balanceValue}>{data.bits} Bits</span>
      </div>

      {message && <div className={styles.message}>{message}</div>}

      {RARITY_ORDER.map((rarity) => {
        const items = data.items.filter((i) => i.rarity === rarity);
        if (items.length === 0) return null;
        return (
          <section key={rarity} className={styles.section}>
            <h3
              className={`${styles.sectionTitle} ${styles[`rarity_${rarity}`]}`}
            >
              {RARITY_LABEL[rarity]}
            </h3>
            <div className={styles.grid}>
              {items.map((item) => {
                const canAfford = data.bits >= item.priceBits;
                return (
                  <div key={item.id} className={styles.card}>
                    <div className={styles.cardIcon}>
                      {item.type === "BADGE" ? (
                        <span className={styles.badgeIcon}>
                          {badgeIcon(item.data?.icon)}
                        </span>
                      ) : item.type === "FRAME" ? (
                        <span
                          className={styles.framePreview}
                          style={
                            item.data?.ring
                              ? { background: item.data.ring }
                              : undefined
                          }
                        />
                      ) : item.type === "BACKGROUND" ? (
                        <span
                          className={styles.bgPreview}
                          style={
                            item.data?.background
                              ? { background: item.data.background }
                              : undefined
                          }
                        />
                      ) : (
                        <span
                          className={styles.titleSample}
                          style={
                            item.data?.color
                              ? { color: item.data.color }
                              : undefined
                          }
                        >
                          {item.name}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardName}>{item.name}</div>
                    {item.description && (
                      <div className={styles.cardDesc}>{item.description}</div>
                    )}
                    <div className={styles.cardFooter}>
                      <span className={styles.price}>
                        {item.priceBits} Bits
                      </span>
                      {item.owned ? (
                        <span className={styles.owned}>Adquirido</span>
                      ) : (
                        <button
                          className={styles.buyBtn}
                          onClick={() => buy(item)}
                          disabled={!canAfford || busyId === item.id}
                        >
                          {busyId === item.id
                            ? "..."
                            : canAfford
                              ? "Comprar"
                              : "Sin Bits"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
