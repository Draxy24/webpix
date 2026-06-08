"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/auth";
import styles from "./ShopView.module.css";
import { badgeIcon } from "../lib/badges";

type ShopItem = {
  id: number;
  key: string;
  type: "TITLE" | "BADGE" | "FRAME" | "BACKGROUND" | "COLOR";
  name: string;
  description: string | null;
  rarity: "COMMON" | "RARE" | "PREMIUM" | null;
  priceBits: number;
  data: {
    icon?: string;
    color?: string;
    ring?: string;
    background?: string;
    token?: string;
    swatch?: string;
  } | null;
  owned: boolean;
};

type ShopData = { bits: number; items: ShopItem[] };

type PaletteColor = {
  id: number;
  name: string;
  data: { swatch?: string } | null;
  owned: boolean;
};
type Palette = {
  key: string;
  name: string;
  description: string;
  bundlePriceBits: number;
  colors: PaletteColor[];
  ownedCount: number;
  total: number;
  fullyOwned: boolean;
};

type BitPackage = {
  key: string;
  name: string;
  bits: number;
  bonus: number;
  total: number;
  priceCents: number;
};

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

export default function ShopView() {
  const { token } = useAuth();
  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [busyPalette, setBusyPalette] = useState<string | null>(null);
  const [packages, setPackages] = useState<BitPackage[]>([]);
  const [busyPackage, setBusyPackage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [shopRes, palRes, pkgRes] = await Promise.all([
        fetch("http://localhost:3001/shop", { headers }),
        fetch("http://localhost:3001/shop/palettes", { headers }),
        fetch("http://localhost:3001/shop/bit-packages", { headers }),
      ]);
      setData(await shopRes.json());
      setPalettes(await palRes.json());
      setPackages(await pkgRes.json());
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
        window.dispatchEvent(new Event("cosmetics-updated"));
        await load();
      }
    } catch {
      setMessage("Error de conexión");
    } finally {
      setBusyId(null);
    }
  };

  const buyPalette = async (p: Palette) => {
    if (!token || busyPalette) return;
    setBusyPalette(p.key);
    setMessage(null);
    try {
      const res = await fetch("http://localhost:3001/shop/buy-palette", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paletteKey: p.key }),
      });
      const result = await res.json();
      if (!res.ok) {
        setMessage(result.message || "No se pudo comprar la paleta");
      } else {
        setMessage(`¡Compraste la ${p.name}!`);
        window.dispatchEvent(new Event("cosmetics-updated"));
        await load();
      }
    } catch {
      setMessage("Error de conexión");
    } finally {
      setBusyPalette(null);
    }
  };

  const buyBits = async (pkg: BitPackage) => {
    if (!token || busyPackage) return;
    setBusyPackage(pkg.key);
    setMessage(null);
    try {
      const res = await fetch("http://localhost:3001/shop/buy-bits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageKey: pkg.key }),
      });
      const result = await res.json();
      if (!res.ok) {
        setMessage(result.message || "No se pudo completar la compra");
      } else {
        setMessage(`¡Recibiste ${result.granted} Bits!`);
        await load();
      }
    } catch {
      setMessage("Error de conexión");
    } finally {
      setBusyPackage(null);
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

      {packages.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Consigue Bits</h3>
          <div className={styles.grid}>
            {packages.map((pkg) => (
              <div key={pkg.key} className={styles.card}>
                <div className={styles.bitsAmount}>
                  <span className={styles.coin}>B</span>
                  {pkg.total.toLocaleString("es-MX")}
                </div>
                <div className={styles.cardName}>{pkg.name}</div>
                {pkg.bonus > 0 && (
                  <div className={styles.bitsBonus}>
                    +{pkg.bonus.toLocaleString("es-MX")} de bonus
                  </div>
                )}
                <div className={styles.cardFooter}>
                  <span className={styles.price}>
                    ${(pkg.priceCents / 100).toFixed(2)}
                  </span>
                  <button
                    className={styles.buyBtn}
                    onClick={() => buyBits(pkg)}
                    disabled={busyPackage === pkg.key}
                  >
                    {busyPackage === pkg.key ? "..." : "Comprar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {palettes.length > 0 && (
        <section className={styles.section}>
          <h3 className={`${styles.sectionTitle} ${styles.rarity_PREMIUM}`}>
            Paletas
          </h3>
          <div className={styles.grid}>
            {palettes.map((p) => {
              const canAfford = data.bits >= p.bundlePriceBits;
              return (
                <div key={p.key} className={styles.card}>
                  <div className={styles.paletteSwatches}>
                    {p.colors.map((c) => (
                      <span
                        key={c.id}
                        className={styles.paletteSwatch}
                        style={
                          c.data?.swatch
                            ? { background: c.data.swatch }
                            : undefined
                        }
                        title={c.name}
                      />
                    ))}
                  </div>
                  <div className={styles.cardName}>{p.name}</div>
                  <div className={styles.cardDesc}>{p.description}</div>
                  <div className={styles.paletteProgress}>
                    {p.ownedCount}/{p.total} adquiridos
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.price}>
                      {p.bundlePriceBits} Bits
                    </span>
                    {p.fullyOwned ? (
                      <span className={styles.owned}>Completa</span>
                    ) : (
                      <button
                        className={styles.buyBtn}
                        onClick={() => buyPalette(p)}
                        disabled={!canAfford || busyPalette === p.key}
                      >
                        {busyPalette === p.key
                          ? "..."
                          : canAfford
                            ? "Comprar paleta"
                            : "Sin Bits"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
                      ) : item.type === "COLOR" ? (
                        <span
                          className={styles.colorPreview}
                          style={
                            item.data?.swatch
                              ? { background: item.data.swatch }
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
