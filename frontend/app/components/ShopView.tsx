"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import styles from "./ShopView.module.css";
import { badgeIcon } from "../lib/badges";
import { cosmeticName, cosmeticDesc } from "../lib/cosmeticText";
import { API_URL } from "@/app/lib/api";

type ShopItem = {
  id: number;
  key: string;
  type: "TITLE" | "BADGE" | "FRAME" | "BACKGROUND" | "COLOR";
  name: string;
  description: string | null;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC" | null;
  priceBits: number;
  data: {
    icon?: string;
    color?: string;
    ring?: string;
    background?: string;
    token?: string;
    swatch?: string;
    image?: string;
  } | null;
  theme?: string | null;
  originalPriceBits?: number | null;
  discountPercent?: number | null;
  owned: boolean;
};

type ShopData = {
  bits: number;
  season: { key: string; label: string; themes: string[] } | null;
  items: ShopItem[];
};

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

const RARITY_ORDER: ("COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC")[] = [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "MYTHIC",
];
const RARITY_RANK: Record<string, number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3,
  MYTHIC: 4,
};
const CATEGORY_ORDER: ShopItem["type"][] = [
  "TITLE",
  "BADGE",
  "FRAME",
  "BACKGROUND",
  "COLOR",
];
const HOME_SAMPLE = 4;

export default function ShopView() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [busyPalette, setBusyPalette] = useState<string | null>(null);
  const [packages, setPackages] = useState<BitPackage[]>([]);
  const [busyPackage, setBusyPackage] = useState<string | null>(null);
  const [tab, setTab] = useState<"shop" | "bits">("shop");
  const [categoryView, setCategoryView] = useState<ShopItem["type"] | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [shopRes, palRes, pkgRes] = await Promise.all([
        fetch(API_URL + "/shop", { headers }),
        fetch(API_URL + "/shop/palettes", { headers }),
        fetch(API_URL + "/shop/bit-packages", { headers }),
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
      const res = await fetch(API_URL + "/shop/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cosmeticId: item.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        setMessage(result.message || t("shop.msg.buyFail"));
      } else {
        setMessage(
          t("shop.msg.bought", { name: cosmeticName(item.key, item.name, t) }),
        );
        window.dispatchEvent(new Event("cosmetics-updated"));
        await load();
      }
    } catch {
      setMessage(t("shop.msg.connError"));
    } finally {
      setBusyId(null);
    }
  };

  const buyPalette = async (p: Palette) => {
    if (!token || busyPalette) return;
    setBusyPalette(p.key);
    setMessage(null);
    try {
      const res = await fetch(API_URL + "/shop/buy-palette", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paletteKey: p.key }),
      });
      const result = await res.json();
      if (!res.ok) {
        setMessage(result.message || t("shop.msg.paletteFail"));
      } else {
        setMessage(
          t("shop.msg.boughtPalette", {
            name: t(`palettes.${p.key}.name`, { defaultValue: p.name }),
          }),
        );
        window.dispatchEvent(new Event("cosmetics-updated"));
        await load();
      }
    } catch {
      setMessage(t("shop.msg.connError"));
    } finally {
      setBusyPalette(null);
    }
  };

  const buyBits = async (pkg: BitPackage) => {
    if (!token || busyPackage) return;
    setBusyPackage(pkg.key);
    setMessage(null);
    try {
      const res = await fetch(API_URL + "/shop/buy-bits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageKey: pkg.key }),
      });
      const result = await res.json();
      if (!res.ok) {
        setMessage(result.message || t("shop.msg.buyFail"));
      } else {
        setMessage(t("shop.msg.gotBits", { count: result.granted }));
        await load();
      }
    } catch {
      setMessage(t("shop.msg.connError"));
    } finally {
      setBusyPackage(null);
    }
  };

  if (!token)
    return <div className={styles.empty}>{t("shop.loginRequired")}</div>;
  if (loading) return <div className={styles.empty}>{t("shop.loading")}</div>;
  if (!data || data.items.length === 0)
    return <div className={styles.empty}>{t("shop.empty")}</div>;

  const featured = [...data.items]
    .sort(
      (a, b) =>
        (RARITY_RANK[b.rarity ?? "COMMON"] ?? 0) -
        (RARITY_RANK[a.rarity ?? "COMMON"] ?? 0),
    )
    .slice(0, 6);

  const season = data.season;
  const seasonItems = season
    ? data.items.filter((i) => !!i.theme && season.themes.includes(i.theme))
    : [];

  const offerItems = data.items.filter((i) => i.originalPriceBits != null);
  const renderCard = (item: ShopItem) => {
    const canAfford = (data?.bits ?? 0) >= item.priceBits;
    return (
      <div key={item.id} className={styles.card}>
        {item.discountPercent ? (
          <span className={styles.discountBadge}>-{item.discountPercent}%</span>
        ) : null}
        <div className={styles.cardIcon}>
          {item.type === "BADGE" ? (
            <span className={styles.badgeIcon}>
              {badgeIcon(item.data?.icon)}
            </span>
          ) : item.type === "FRAME" ? (
            item.data?.image ? (
              <img
                src={item.data.image}
                alt=""
                className={styles.framePreviewImg}
              />
            ) : (
              <span
                className={styles.framePreview}
                style={
                  item.data?.ring ? { background: item.data.ring } : undefined
                }
              />
            )
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
                item.data?.swatch ? { background: item.data.swatch } : undefined
              }
            />
          ) : (
            <span
              className={styles.titleSample}
              style={item.data?.color ? { color: item.data.color } : undefined}
            >
              {cosmeticName(item.key, item.name, t)}
            </span>
          )}
        </div>
        <div className={styles.cardName}>
          {cosmeticName(item.key, item.name, t)}
        </div>
        {cosmeticDesc(item.key, item.description, t) && (
          <div className={styles.cardDesc}>
            {cosmeticDesc(item.key, item.description, t)}
          </div>
        )}
        <div className={styles.cardFooter}>
          {item.originalPriceBits ? (
            <span className={styles.priceOffer}>
              <span className={styles.priceOriginal}>
                {item.originalPriceBits}
              </span>
              <span className={styles.price}>{item.priceBits} Bits</span>
            </span>
          ) : (
            <span className={styles.price}>{item.priceBits} Bits</span>
          )}
          {item.owned ? (
            <span className={styles.owned}>{t("shop.owned")}</span>
          ) : (
            <button
              className={styles.buyBtn}
              onClick={() => buy(item)}
              disabled={!canAfford || busyId === item.id}
            >
              {busyId === item.id
                ? "..."
                : canAfford
                  ? t("shop.buy")
                  : t("shop.noBits")}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.balance}>
        <span className={styles.balanceLabel}>{t("shop.balance")}</span>
        <span className={styles.balanceValue}>{data.bits} Bits</span>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "shop" ? styles.tabActive : ""}`}
          onClick={() => {
            setTab("shop");
            setCategoryView(null);
          }}
        >
          {t("shop.tabs.shop")}
        </button>
        <button
          className={`${styles.tab} ${tab === "bits" ? styles.tabActive : ""}`}
          onClick={() => setTab("bits")}
        >
          {t("shop.tabs.bits")}
        </button>
      </div>

      {message && <div className={styles.message}>{message}</div>}

      {tab === "bits" && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t("shop.getBits")}</h3>
          <div className={styles.grid}>
            {packages.map((pkg) => (
              <div key={pkg.key} className={styles.card}>
                <div className={styles.bitsAmount}>
                  <span className={styles.coin}>B</span>
                  {pkg.total.toLocaleString(i18n.language)}
                </div>
                <div className={styles.cardName}>
                  {t(`bitPackages.${pkg.key}`, { defaultValue: pkg.name })}
                </div>
                {pkg.bonus > 0 && (
                  <div className={styles.bitsBonus}>
                    {t("shop.bonus", {
                      amount: pkg.bonus.toLocaleString(i18n.language),
                    })}
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
                    {busyPackage === pkg.key ? "..." : t("shop.buy")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "shop" && categoryView && (
        <div>
          <button
            className={styles.backBtn}
            onClick={() => setCategoryView(null)}
          >
            ← {t("shop.back")}
          </button>
          <h3 className={styles.sectionTitle}>
            {t(`shop.category.${categoryView}`)}
          </h3>
          {RARITY_ORDER.map((rarity) => {
            const items = data.items.filter(
              (i) => i.type === categoryView && i.rarity === rarity,
            );
            if (items.length === 0) return null;
            return (
              <div key={rarity} className={styles.subSection}>
                <div
                  className={`${styles.raritySub} ${styles[`rarity_${rarity}`]}`}
                >
                  {t(`shop.rarity.${rarity}`)}
                </div>
                <div className={styles.grid}>{items.map(renderCard)}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "shop" && !categoryView && (
        <>
          {featured.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>{t("shop.featured")}</h3>
              <div className={styles.grid}>{featured.map(renderCard)}</div>
            </section>
          )}

          {offerItems.length > 0 && (
            <section className={styles.section}>
              <h3 className={`${styles.sectionTitle} ${styles.offerTitle}`}>
                {t("shop.offers")}
              </h3>
              <div className={styles.grid}>{offerItems.map(renderCard)}</div>
            </section>
          )}

          {season && seasonItems.length > 0 && (
            <section className={styles.section}>
              <h3 className={`${styles.sectionTitle} ${styles.seasonTitle}`}>
                ✨ {t(`seasons.${season.key}`, { defaultValue: season.label })}
              </h3>
              <div className={styles.grid}>{seasonItems.map(renderCard)}</div>
            </section>
          )}

          {CATEGORY_ORDER.map((type) => {
            const items = data.items.filter((i) => i.type === type);
            if (items.length === 0) return null;
            return (
              <section key={type} className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    {t(`shop.category.${type}`)}
                  </h3>
                  {items.length > HOME_SAMPLE && (
                    <button
                      className={styles.seeAll}
                      onClick={() => setCategoryView(type)}
                    >
                      {t("shop.seeAll", { count: items.length })}
                    </button>
                  )}
                </div>
                <div className={styles.grid}>
                  {items.slice(0, HOME_SAMPLE).map(renderCard)}
                </div>
              </section>
            );
          })}

          {palettes.length > 0 && (
            <section className={styles.section}>
              <h3
                className={`${styles.sectionTitle} ${styles.rarity_LEGENDARY}`}
              >
                {t("shop.palettes")}
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
                      <div className={styles.cardName}>
                        {t(`palettes.${p.key}.name`, { defaultValue: p.name })}
                      </div>
                      <div className={styles.cardDesc}>
                        {t(`palettes.${p.key}.desc`, {
                          defaultValue: p.description,
                        })}
                      </div>
                      <div className={styles.paletteProgress}>
                        {t("shop.paletteProgress", {
                          owned: p.ownedCount,
                          total: p.total,
                        })}
                      </div>
                      <div className={styles.cardFooter}>
                        <span className={styles.price}>
                          {p.bundlePriceBits} Bits
                        </span>
                        {p.fullyOwned ? (
                          <span className={styles.owned}>
                            {t("shop.paletteComplete")}
                          </span>
                        ) : (
                          <button
                            className={styles.buyBtn}
                            onClick={() => buyPalette(p)}
                            disabled={!canAfford || busyPalette === p.key}
                          >
                            {busyPalette === p.key
                              ? "..."
                              : canAfford
                                ? t("shop.buyPalette")
                                : t("shop.noBits")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
