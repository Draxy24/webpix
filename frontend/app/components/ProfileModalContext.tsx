"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import ProfileView from "./ProfileView";
import PublicationView from "./PublicationView";
import styles from "./UserModal.module.css";
import { useTranslation } from "react-i18next";

type View =
  | { type: "profile"; nickname: string }
  | { type: "publication"; id: string };

type ProfileModalCtx = {
  openProfile: (nickname: string) => void;
  openPublication: (id: string | number) => void;
};

const Ctx = createContext<ProfileModalCtx | null>(null);

export function useProfileModal() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      "useProfileModal debe usarse dentro de ProfileModalProvider",
    );
  return ctx;
}

export function ProfileModalProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [stack, setStack] = useState<View[]>([]);

  const openProfile = useCallback((nickname: string) => {
    setStack([{ type: "profile", nickname }]);
  }, []);
  const openPublication = useCallback((id: string | number) => {
    setStack([{ type: "publication", id: String(id) }]);
  }, []);
  const close = useCallback(() => setStack([]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const pushView = useCallback((v: View) => setStack((s) => [...s, v]), []);

  const current = stack[stack.length - 1] ?? null;

  return (
    <Ctx.Provider value={{ openProfile, openPublication }}>
      {children}
      {current && (
        <div className={styles.overlay} onClick={close}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bar}>
              {stack.length > 1 ? (
                <button className={styles.backBtn} onClick={back}>
                  ← {t("common.back")}
                </button>
              ) : (
                <span />
              )}
              <button
                className={styles.closeBtn}
                onClick={close}
                aria-label={t("common.close")}
              >
                ×
              </button>
            </div>
            <div className={styles.body}>
              {current.type === "profile" ? (
                <ProfileView
                  key={current.nickname}
                  nickname={current.nickname}
                  onOpenPublication={(id) =>
                    pushView({ type: "publication", id: String(id) })
                  }
                />
              ) : (
                <PublicationView
                  key={current.id}
                  id={current.id}
                  onOpenProfile={(nickname) =>
                    pushView({ type: "profile", nickname })
                  }
                />
              )}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
