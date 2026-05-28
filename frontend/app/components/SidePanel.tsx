"use client";

import styles from "./SidePanel.module.css";

export default function SidePanel({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.panel} ${open ? styles.panelOpen : ""}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button className={styles.close} onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
