"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { SUPPORTED } from "../lib/i18n";

function detect(): string {
  try {
    const saved = localStorage.getItem("webpix_lang");
    if (saved && (SUPPORTED as readonly string[]).includes(saved)) return saved;
  } catch {}
  const nav = (navigator.language || "es").slice(0, 2);
  return (SUPPORTED as readonly string[]).includes(nav) ? nav : "es";
}

export default function I18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const lng = detect();
    document.documentElement.lang = lng;
    if (lng !== i18n.language) void i18n.changeLanguage(lng);
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
