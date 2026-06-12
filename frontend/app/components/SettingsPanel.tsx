"use client";

import { useSettings } from "../context/settings";
import styles from "./SettingsPanel.module.css";
import { useTranslation } from "react-i18next";
import { LANGS, setLanguage } from "../lib/i18n";

export default function SettingsPanel({
  palette,
  showCustomColor,
}: {
  palette: string[];
  showCustomColor: boolean;
}) {
  const { settings, updateSetting } = useSettings();
  const { t, i18n } = useTranslation();

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Color del menú</h3>
        <p className={styles.hint}>
          Personaliza el color de tu menú y botones.
        </p>
        <div className={styles.swatchGrid}>
          {palette.map((c) => (
            <button
              key={c}
              className={`${styles.swatch} ${
                settings.menuColor.toLowerCase() === c.toLowerCase()
                  ? styles.swatchActive
                  : ""
              }`}
              style={{ background: c }}
              onClick={() => updateSetting("menuColor", c)}
              aria-label={c}
            />
          ))}
        </div>
        {showCustomColor && (
          <div className={styles.customRow}>
            <input
              type="color"
              value={settings.menuColor}
              onChange={(e) => updateSetting("menuColor", e.target.value)}
            />
            <span className={styles.hint}>Color personalizado</span>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Lienzo</h3>
        <label className={styles.row}>
          <span>Mostrar rejilla desde</span>
          <select
            value={settings.gridThreshold}
            onChange={(e) =>
              updateSetting("gridThreshold", Number(e.target.value))
            }
            className={styles.select}
          >
            <option value={2}>2×</option>
            <option value={3}>3×</option>
            <option value={5}>5×</option>
            <option value={8}>8×</option>
            <option value={999}>Nunca</option>
          </select>
        </label>
        <label className={styles.rowToggle}>
          <span>Mostrar coordenadas</span>
          <input
            type="checkbox"
            checked={settings.showCoords}
            onChange={(e) => updateSetting("showCoords", e.target.checked)}
          />
        </label>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Apariencia y sonido</h3>
        <label className={styles.rowToggle}>
          <span>Modo claro</span>
          <input
            type="checkbox"
            checked={settings.theme === "light"}
            onChange={(e) =>
              updateSetting("theme", e.target.checked ? "light" : "dark")
            }
          />
        </label>
        <label className={styles.rowToggle}>
          <span>Efectos de sonido</span>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={(e) => updateSetting("soundEnabled", e.target.checked)}
          />
        </label>
        <label className={styles.row}>
          <span>{t("settings.language")}</span>
          <select
            value={i18n.language}
            onChange={(e) => setLanguage(e.target.value)}
            className={styles.select}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </section>
    </div>
  );
}
