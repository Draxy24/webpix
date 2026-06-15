import type { TFunction } from "i18next";

// Traducción de nombre/descripción de logros y tareas semanales por su `key`,
// con fallback al texto en español que envía el backend.
// El backend siempre manda name/description en español, así que es.json
// NO necesita estas claves: solo en/de/fr/zh.

function lookup(
  ns: "achievements" | "tasks",
  field: "name" | "desc",
  key: string,
  fallback: string | null,
  t: TFunction,
): string {
  return String(
    t(`${ns}.items.${key}.${field}`, { defaultValue: fallback ?? "" }),
  );
}

export function achievementName(
  key: string,
  fallback: string,
  t: TFunction,
): string {
  return lookup("achievements", "name", key, fallback, t);
}

export function achievementDesc(
  key: string,
  fallback: string | null,
  t: TFunction,
): string | null {
  return lookup("achievements", "desc", key, fallback, t) || null;
}

export function taskName(key: string, fallback: string, t: TFunction): string {
  return lookup("tasks", "name", key, fallback, t);
}

export function taskDesc(
  key: string,
  fallback: string | null,
  t: TFunction,
): string | null {
  return lookup("tasks", "desc", key, fallback, t) || null;
}
