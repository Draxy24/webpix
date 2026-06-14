import type { TFunction } from "i18next";

export function cosmeticName(
  key: string | null | undefined,
  fallback: string,
  t: TFunction,
): string {
  if (!key) return fallback;
  return t(`cosmetics.${key}.name`, { defaultValue: fallback });
}

export function cosmeticDesc(
  key: string | null | undefined,
  fallback: string | null,
  t: TFunction,
): string {
  if (!fallback) return "";
  if (!key) return fallback;
  return t(`cosmetics.${key}.desc`, { defaultValue: fallback });
}
