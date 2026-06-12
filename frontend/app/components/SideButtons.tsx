"use client";

import styles from "./SideButtons.module.css";
import { useTranslation } from "react-i18next";

export type PanelSection =
  | "menu"
  | "settings"
  | "achievements"
  | "tasks"
  | "bug";

function Icon({ section }: { section: PanelSection | "bug" | "cart" }) {
  switch (section) {
    case "menu":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="3" width="12" height="2" />
          <rect x="2" y="7" width="12" height="2" />
          <rect x="2" y="11" width="12" height="2" />
        </svg>
      );
    case "settings":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="6" y="1" width="4" height="3" />
          <rect x="6" y="12" width="4" height="3" />
          <rect x="1" y="6" width="3" height="4" />
          <rect x="12" y="6" width="3" height="4" />
          <rect x="3" y="3" width="3" height="3" />
          <rect x="10" y="3" width="3" height="3" />
          <rect x="3" y="10" width="3" height="3" />
          <rect x="10" y="10" width="3" height="3" />
          <rect x="6" y="6" width="4" height="4" />
        </svg>
      );
    case "achievements":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="4" y="2" width="8" height="5" />
          <rect x="5" y="7" width="6" height="2" />
          <rect x="2" y="3" width="2" height="3" />
          <rect x="12" y="3" width="2" height="3" />
          <rect x="7" y="9" width="2" height="2" />
          <rect x="5" y="11" width="6" height="2" />
          <rect x="4" y="13" width="8" height="2" />
        </svg>
      );
    case "tasks":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="4" y="1" width="2" height="3" />
          <rect x="10" y="1" width="2" height="3" />
          <rect x="2" y="3" width="12" height="2" />
          <rect x="2" y="3" width="2" height="11" />
          <rect x="12" y="3" width="2" height="11" />
          <rect x="2" y="12" width="12" height="2" />
          <rect x="5" y="7" width="2" height="2" />
          <rect x="9" y="7" width="2" height="2" />
        </svg>
      );
    case "bug":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="5" y="4" width="6" height="8" />
          <rect x="6" y="2" width="4" height="2" />
          <rect x="2" y="5" width="3" height="2" />
          <rect x="2" y="9" width="3" height="2" />
          <rect x="11" y="5" width="3" height="2" />
          <rect x="11" y="9" width="3" height="2" />
        </svg>
      );
    case "cart":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="6" y="2" width="4" height="2" />
          <rect x="5" y="3" width="2" height="2" />
          <rect x="9" y="3" width="2" height="2" />
          <rect x="3" y="5" width="10" height="9" />
        </svg>
      );
  }
}

export default function SideButtons({
  activeSection,
  onSelect,
  onReportBug,
  onOpenShop,
  panelOpen,
}: {
  activeSection: PanelSection | null;
  onSelect: (section: PanelSection) => void;
  onReportBug: () => void;
  onOpenShop: () => void;
  panelOpen: boolean;
}) {
  const { t } = useTranslation();
  const sections: PanelSection[] = [
    "menu",
    "settings",
    "achievements",
    "tasks",
  ];

  return (
    <div className={`${styles.stack} ${panelOpen ? styles.stackShifted : ""}`}>
      {sections.map((s) => (
        <button
          key={s}
          className={`${styles.button} ${activeSection === s ? styles.buttonActive : ""}`}
          onClick={() => onSelect(s)}
          title={t(`panel.titles.${s}`)}
        >
          <Icon section={s} />
        </button>
      ))}
      <button
        className={styles.button}
        onClick={onOpenShop}
        title={t("panel.titles.shop")}
      >
        <Icon section="cart" />
      </button>
      <button
        className={styles.button}
        onClick={onReportBug}
        title={t("panel.titles.bug")}
      >
        <Icon section="bug" />
      </button>
    </div>
  );
}
