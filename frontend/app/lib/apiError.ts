import type { TFunction } from "i18next";

type ApiErrorData =
  | { message?: string; code?: string; params?: Record<string, unknown> }
  | null
  | undefined;

// Traduce un error de la API: usa `code` -> errors.<code> (con `params` de
// interpolación) y cae al `message` en español del backend si no hay code.
export function apiErrorText(
  data: ApiErrorData,
  t: TFunction,
  fallback?: string,
): string {
  const msg = data?.message ?? fallback ?? "";
  if (data?.code) {
    return String(
      t(`errors.${data.code}`, { defaultValue: msg, ...(data.params ?? {}) }),
    );
  }
  return msg;
}
