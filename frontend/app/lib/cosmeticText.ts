import type { TFunction } from "i18next";
import i18n from "./i18n";

// Mapa de tier del key → clave i18n. El key de medalla es "medal_<tier>_<metric>_<period>".
const MEDAL_TIERS: Record<string, string> = {
  gold: "gold",
  silver: "silver",
  bronze: "bronze",
};

const MEDAL_METRICS: Record<string, string> = {
  pixels: "pixels",
  creators: "creators",
};

// Parsea un key de medalla. Devuelve null si no es una medalla.
// Formato: "medal_gold_pixels_2026-06"
function parseMedalKey(
  key: string,
): { tier: string; metric: string; period: string } | null {
  if (!key.startsWith("medal_")) return null;
  const parts = key.split("_");
  // ["medal", "gold", "pixels", "2026-06"]
  if (parts.length !== 4) return null;
  const [, tier, metric, period] = parts;
  if (!MEDAL_TIERS[tier] || !MEDAL_METRICS[metric]) return null;
  return { tier, metric, period };
}

// Formatea "2026-06" → "junio 2026" / "June 2026" / etc., según el idioma.
function formatPeriod(period: string, locale: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  try {
    const date = new Date(Date.UTC(y, m - 1, 1));
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return period;
  }
}

export function cosmeticName(
  key: string | null | undefined,
  fallback: string,
  t: TFunction,
): string {
  if (!key) return fallback;

  // Caso especial: medallas de ranking (texto dinámico, se arma traducido).
  const medal = parseMedalKey(key);
  if (medal) {
    const tier = t(`cosmetics.medal.tier.${medal.tier}`, {
      defaultValue: medal.tier,
    });
    const metric = t(`cosmetics.medal.metric.${medal.metric}`, {
      defaultValue: medal.metric,
    });
    const period = formatPeriod(medal.period, i18n.language);
    return t("cosmetics.medal.name", {
      defaultValue: "Medalla de {{tier}} · {{metric}} · {{period}}",
      tier,
      metric,
      period,
    });
  }

  return t(`cosmetics.${key}.name`, { defaultValue: fallback });
}

export function cosmeticDesc(
  key: string | null | undefined,
  fallback: string | null,
  t: TFunction,
): string {
  if (!fallback) return "";
  if (!key) return fallback;

  // Caso especial: descripción de medalla, también dinámica.
  const medal = parseMedalKey(key);
  if (medal) {
    const metric = t(`cosmetics.medal.metric.${medal.metric}`, {
      defaultValue: medal.metric,
    });
    const period = formatPeriod(medal.period, i18n.language);
    const pos = medal.tier === "gold" ? 1 : medal.tier === "silver" ? 2 : 3;
    return t("cosmetics.medal.desc", {
      defaultValue: "Top {{pos}} de {{metric}} en {{period}}",
      pos,
      metric,
      period,
    });
  }

  return t(`cosmetics.${key}.desc`, { defaultValue: fallback });
}
