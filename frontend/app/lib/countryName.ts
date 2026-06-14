// Nombres de país localizados vía Intl.DisplayNames.
// Espera códigos ISO 3166-1 alpha-2 ("MX", "GT", "DE"...).

const cache = new Map<string, Intl.DisplayNames>();

function getDisplayNames(locale: string): Intl.DisplayNames | null {
  const cached = cache.get(locale);
  if (cached) return cached;
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    cache.set(locale, dn);
    return dn;
  } catch {
    return null;
  }
}

export function countryName(
  code: string | null | undefined,
  locale: string,
): string {
  if (!code) return "";
  const dn = getDisplayNames(locale);
  if (!dn) return code;
  try {
    return dn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
