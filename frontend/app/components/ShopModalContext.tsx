"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import ShopView from "./ShopView";
import styles from "./UserModal.module.css";
import { useTranslation } from "react-i18next";

type ShopModalCtx = {
  openShop: () => void;
  closeShop: () => void;
};

const Ctx = createContext<ShopModalCtx | null>(null);

export function useShopModal() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useShopModal debe usarse dentro de ShopModalProvider");
  return ctx;
}

export function ShopModalProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const openShop = useCallback(() => setOpen(true), []);
  const closeShop = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ openShop, closeShop }}>
      {children}
      {open && (
        <div className={styles.overlay} onClick={closeShop}>
          <div
            className={styles.modal}
            style={{ maxWidth: 920 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.bar}>
              <span
                style={{
                  fontFamily: "var(--font-display), monospace",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text)",
                }}
              >
                {t("shop.modalTitle")}
              </span>
              <button
                className={styles.closeBtn}
                onClick={closeShop}
                aria-label={t("common.close")}
              >
                ×
              </button>
            </div>
            <div className={styles.body}>
              <ShopView />
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
