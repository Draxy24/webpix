"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./locales/es.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import zh from "./locales/zh.json";

export const SUPPORTED = ["es", "en", "de", "fr", "zh"] as const;

export const LANGS: { code: string; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "zh", label: "中文" },
];

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
      zh: { translation: zh },
    },
    lng: "es", // valor inicial estable para el SSR; se ajusta en el cliente
    fallbackLng: "es",
    supportedLngs: SUPPORTED as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export function setLanguage(code: string) {
  try {
    localStorage.setItem("webpix_lang", code);
  } catch {}
  if (typeof document !== "undefined") document.documentElement.lang = code;
  void i18n.changeLanguage(code);
}

export default i18n;
