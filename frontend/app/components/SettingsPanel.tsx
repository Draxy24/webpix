"use client";

import { useSettings } from "../context/settings";
import styles from "./SettingsPanel.module.css";

export default function SettingsPanel({
  palette,
  showCustomColor,
}: {
  palette: string[];
  showCustomColor: boolean;
}) {
  const { settings, updateSetting } = useSettings();

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
        <div className={styles.comingSoon}>
          Tema claro/oscuro · próximamente
        </div>
        <div className={styles.comingSoon}>Idioma · próximamente</div>
        <div className={styles.comingSoon}>
          Efectos de sonido · próximamente
        </div>
      </section>
    </div>
  );
}
