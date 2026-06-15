"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import styles from "./NotificationProvider.module.css";

type ToastType = "success" | "error" | "info" | "reward";

type Toast = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  icon?: string;
  duration: number;
  leaving: boolean;
};

type NotifyOptions = {
  type?: ToastType;
  title: string;
  message?: string;
  icon?: string;
  duration?: number;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmState = {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
} | null;

type NotificationContextValue = {
  notify: (opts: NotifyOptions) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  reward: (title: string, message?: string, icon?: string) => void;
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error("useNotify debe usarse dentro de <NotificationProvider>");
  return ctx;
}

const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 4200;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((ts) => ts.filter((x) => x.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setToasts((ts) =>
        ts.map((x) => (x.id === id ? { ...x, leaving: true } : x)),
      );
      window.setTimeout(() => remove(id), 220);
    },
    [remove],
  );

  const notify = useCallback(
    (opts: NotifyOptions) => {
      const id = (counter.current += 1);
      const duration = opts.duration ?? DEFAULT_DURATION;
      const toast: Toast = {
        id,
        type: opts.type ?? "info",
        title: opts.title,
        message: opts.message,
        icon: opts.icon,
        duration,
        leaving: false,
      };
      setToasts((ts) => [...ts, toast].slice(-MAX_VISIBLE));
      if (duration > 0) window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const success = useCallback(
    (title: string, message?: string) =>
      notify({ type: "success", title, message }),
    [notify],
  );
  const error = useCallback(
    (title: string, message?: string) =>
      notify({ type: "error", title, message, duration: 5200 }),
    [notify],
  );
  const info = useCallback(
    (title: string, message?: string) =>
      notify({ type: "info", title, message }),
    [notify],
  );
  const reward = useCallback(
    (title: string, message?: string, icon?: string) =>
      notify({ type: "reward", title, message, icon, duration: 5200 }),
    [notify],
  );

  const confirm = useCallback((optsOrMessage: ConfirmOptions | string) => {
    const opts: ConfirmOptions =
      typeof optsOrMessage === "string"
        ? { message: optsOrMessage }
        : optsOrMessage;
    return new Promise<boolean>((resolve) =>
      setConfirmState({ opts, resolve }),
    );
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((cur) => {
      cur?.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState, closeConfirm]);

  const value = useMemo<NotificationContextValue>(
    () => ({ notify, success, error, info, reward, confirm }),
    [notify, success, error, info, reward, confirm],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}

      <div
        className={styles.stack}
        role="region"
        aria-live="polite"
        aria-label={t("common.notifications", {
          defaultValue: "Notificaciones",
        })}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.type]} ${toast.leaving ? styles.leaving : ""}`}
            role="status"
          >
            <span className={styles.iconSlot}>
              <ToastIcon type={toast.type} icon={toast.icon} />
            </span>
            <div className={styles.body}>
              <div className={styles.title}>{toast.title}</div>
              {toast.message && (
                <div className={styles.message}>{toast.message}</div>
              )}
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label={t("common.close")}
              onClick={() => dismiss(toast.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div
          className={styles.overlay}
          onClick={() => closeConfirm(false)}
          role="presentation"
        >
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {confirmState.opts.title && (
              <div className={styles.dialogTitle}>
                {confirmState.opts.title}
              </div>
            )}
            <div className={styles.dialogMessage}>
              {confirmState.opts.message}
            </div>
            <div className={styles.dialogActions}>
              <button
                type="button"
                autoFocus
                className={styles.btnCancel}
                onClick={() => closeConfirm(false)}
              >
                {confirmState.opts.cancelText ??
                  t("common.cancel", { defaultValue: "Cancelar" })}
              </button>
              <button
                type="button"
                className={`${styles.btnConfirm} ${confirmState.opts.danger ? styles.btnDanger : ""}`}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.opts.confirmText ??
                  t("common.confirm", { defaultValue: "Confirmar" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

function ToastIcon({ type, icon }: { type: ToastType; icon?: string }) {
  if (icon) return <img src={icon} alt="" className={styles.iconImg} />;

  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (type === "success")
    return (
      <svg {...common}>
        <path d="M5 13l4 4L19 7" />
      </svg>
    );
  if (type === "error")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16.2v.2" />
      </svg>
    );
  if (type === "reward")
    return (
      <svg {...common} fill="currentColor" stroke="none">
        <path d="M12 2.6l2.6 5.6 6 .7-4.4 4.2 1.1 5.9L12 16.9 6.7 19l1.1-5.9L3.4 8.9l6-.7z" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.8v.2" />
    </svg>
  );
}
