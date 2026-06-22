"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";
import styles from "./ShopView.module.css";
import { badgeIcon } from "../lib/badges";
import { cosmeticName, cosmeticDesc } from "../lib/cosmeticText";
import { API_URL } from "@/app/lib/api";
import { useNotify } from "./NotificationProvider";
import { eventToast } from "../lib/rewardToast";

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
  tier: "FREE" | "PLUS" | "PREMIUM";
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
  icon: string;
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
  const { reward } = useNotify();
  const { token } = useAuth();
  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [busyPalette, setBusyPalette] = useState<string | null>(null);
  const [packages, setPackages] = useState<BitPackage[]>([]);
  const [busyPackage, setBusyPackage] = useState<string | null>(null);
  const [tab, setTab] = useState<"shop" | "bits" | "subscriptions">("shop");
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bits = params.get("bits");
    const sub = params.get("sub");
    if (bits === "ok")
      setMessage(t("shop.msg.bitsOk", { defaultValue: "¡Bits añadidos!" }));
    else if (sub === "ok")
      setMessage(
        t("shop.msg.subOk", { defaultValue: "¡Suscripción activada!" }),
      );
    else if (sub === "cancel")
      setMessage(
        t("shop.msg.subCancel", { defaultValue: "Suscripción cancelada." }),
      );
    if (bits || sub)
      window.history.replaceState({}, "", window.location.pathname);
  }, [t]);

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
        setMessage(
          t(`shop.errors.${result.code}`, {
            defaultValue: result.message || t("shop.msg.buyFail"),
          }),
        );
      } else {
        setMessage(
          t("shop.msg.bought", { name: cosmeticName(item.key, item.name, t) }),
        );
        if (Array.isArray(result.events)) {
          for (const ev of result.events) eventToast(ev, t, reward);
        }
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
        setMessage(
          t(`shop.errors.${result.code}`, {
            defaultValue: result.message || t("shop.msg.paletteFail"),
          }),
        );
      } else {
        setMessage(
          t("shop.msg.boughtPalette", {
            name: t(`palettes.${p.key}.name`, { defaultValue: p.name }),
          }),
        );
        if (Array.isArray(result.events)) {
          for (const ev of result.events) eventToast(ev, t, reward);
        }
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
        setMessage(
          t(`shop.errors.${result.code}`, {
            defaultValue: result.message || t("shop.msg.buyFail"),
          }),
        );
        setBusyPackage(null);
        return;
      }
      if (result.url) {
        window.location.href = result.url; // a Stripe Checkout
        return; // nos vamos de la página; no reseteamos busy
      }
      setBusyPackage(null);
    } catch {
      setMessage(t("shop.msg.connError"));
      setBusyPackage(null);
    }
  };

  const subscribe = async (tier: "PLUS" | "PREMIUM") => {
    if (!token || busyPackage) return;
    setBusyPackage(tier);
    try {
      const res = await fetch(API_URL + "/shop/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier }),
      });
      const result = await res.json();
      if (res.ok && result.url) {
        window.location.href = result.url;
        return;
      }
      setMessage(
        t(`shop.errors.${result.code}`, {
          defaultValue: result.message || t("shop.msg.buyFail"),
        }),
      );
      setBusyPackage(null);
    } catch {
      setMessage(t("shop.msg.connError"));
      setBusyPackage(null);
    }
  };

  const openBillingPortal = async () => {
    if (!token) return;
    try {
      const res = await fetch(API_URL + "/shop/billing-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (res.ok && result.url) {
        window.location.href = result.url;
        return;
      }
      setMessage(
        t(`shop.errors.${result.code}`, {
          defaultValue: result.message || t("shop.msg.buyFail"),
        }),
      );
    } catch {
      setMessage(t("shop.msg.connError"));
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
        <button
          className={`${styles.tab} ${tab === "subscriptions" ? styles.tabActive : ""}`}
          onClick={() => {
            setTab("subscriptions");
            setCategoryView(null);
          }}
        >
          {t("shop.tabs.subs", { defaultValue: "Suscripciones" })}
        </button>
      </div>

      {message && <div className={styles.message}>{message}</div>}

      {tab === "bits" && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t("shop.getBits")}</h3>
          <div className={styles.grid}>
            {packages.map((pkg) => (
              <div key={pkg.key} className={styles.card}>
                <img src={pkg.icon} alt="" className={styles.bitsIconBig} />
                <div className={styles.bitsAmount}>
                  {pkg.total.toLocaleString(i18n.language)} Bits
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
                    ${(pkg.priceCents / 100).toFixed(2)} MXN
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

      {tab === "subscriptions" && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {t("subs.title", { defaultValue: "Suscripciones" })}
          </h3>
          <div className={styles.subGrid}>
            {(["FREE", "PLUS", "PREMIUM"] as const).map((tier) => {
              const isCurrent = data.tier === tier;
              const price =
                tier === "PLUS"
                  ? "$35 MXN"
                  : tier === "PREMIUM"
                    ? "$85 MXN"
                    : null;
              return (
                <div
                  key={tier}
                  className={`${styles.subCard} ${isCurrent ? styles.subCardCurrent : ""}`}
                >
                  <div className={styles.subSign}>
                    {tier === "FREE"
                      ? "Free"
                      : tier === "PLUS"
                        ? "Plus"
                        : "Premium"}
                  </div>
                  {price && (
                    <div className={styles.subPrice}>
                      {price}
                      <span className={styles.subPer}>
                        {t("subs.perMonth", { defaultValue: "/mes" })}
                      </span>
                    </div>
                  )}
                  <ul className={styles.subPerks}>
                    <li className={styles.subBits}>
                      {t(`subs.${tier}.bits`, {
                        defaultValue:
                          tier === "FREE"
                            ? "Sin retorno de Bits"
                            : tier === "PLUS"
                              ? "+200 Bits al mes"
                              : "+500 Bits al mes",
                      })}
                    </li>
                    <li>
                      {t(`subs.${tier}.palette`, {
                        defaultValue:
                          tier === "PREMIUM"
                            ? "Paleta de 32 colores + selector libre, para pintar y el menú"
                            : tier === "PLUS"
                              ? "Paleta de 32 colores, para pintar y el menú"
                              : "Paleta de 16 colores, para pintar y el menú",
                      })}
                    </li>
                    <li>
                      {t(`subs.${tier}.limits`, {
                        defaultValue:
                          tier === "PREMIUM"
                            ? "Sin límite de píxeles ni cooldown"
                            : tier === "PLUS"
                              ? "60 píxeles · cooldown de 1 h"
                              : "30 píxeles · cooldown de 3 h",
                      })}
                    </li>
                  </ul>
                  <div className={styles.subFooter}>
                    {isCurrent ? (
                      <span className={styles.subCurrent}>
                        {t("subs.current", { defaultValue: "Tu plan actual" })}
                      </span>
                    ) : tier === "FREE" ? (
                      <span className={styles.subFreeNote}>—</span>
                    ) : (
                      <button
                        className={styles.buyBtn}
                        onClick={() => subscribe(tier)}
                        disabled={busyPackage === tier}
                      >
                        {busyPackage === tier
                          ? "..."
                          : t("subs.subscribe", {
                              defaultValue: "Suscribirse",
                            })}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {data.tier !== "FREE" && (
            <button className={styles.manageBtn} onClick={openBillingPortal}>
              {t("subs.manage", { defaultValue: "Gestionar suscripción" })}
            </button>
          )}
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
