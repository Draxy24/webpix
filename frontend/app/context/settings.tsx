"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Settings = {
  menuColor: string;
  gridThreshold: number;
  showCoords: boolean;
  theme: "dark" | "light";
  soundEnabled: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  menuColor: "#FF7A1A",
  gridThreshold: 3,
  showCoords: false,
  theme: "dark",
  soundEnabled: true,
};

const SettingsContext = createContext<{
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
} | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("settings");
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--color-menu",
      settings.menuColor,
    );
    document.documentElement.setAttribute("data-theme", settings.theme);
    localStorage.setItem("settings", JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx)
    throw new Error("useSettings debe usarse dentro de SettingsProvider");
  return ctx;
}
