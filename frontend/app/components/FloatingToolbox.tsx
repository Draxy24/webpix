"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FloatingToolbox.module.css";
import { useTranslation } from "react-i18next";

export type Tool = "brush" | "eraser" | "publish" | "private" | "report";
export type EraseMode = "point" | "area";
export type PrivateMode = "buy" | "manage";

const TOOL_ENABLED: Record<Tool, boolean> = {
  brush: true,
  eraser: true,
  publish: true,
  private: true,
  report: true,
};

function ToolIcon({ tool }: { tool: Tool }) {
  switch (tool) {
    case "brush":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="12" y="2" width="2" height="2" />
          <rect x="10" y="4" width="2" height="2" />
          <rect x="8" y="6" width="2" height="2" />
          <rect x="4" y="8" width="4" height="2" />
          <rect x="2" y="10" width="6" height="4" />
        </svg>
      );
    case "eraser":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="4" width="12" height="3" opacity="0.5" />
          <rect x="2" y="7" width="12" height="5" />
        </svg>
      );
    case "publish":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="3" width="12" height="2" />
          <rect x="2" y="11" width="12" height="2" />
          <rect x="2" y="3" width="2" height="10" />
          <rect x="12" y="3" width="2" height="10" />
          <rect x="6" y="7" width="4" height="2" />
        </svg>
      );
    case "private":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="5" y="2" width="6" height="2" />
          <rect x="5" y="4" width="2" height="3" />
          <rect x="9" y="4" width="2" height="3" />
          <rect x="3" y="7" width="10" height="7" />
        </svg>
      );
    case "report":
      return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <rect x="3" y="2" width="2" height="12" />
          <rect x="5" y="3" width="8" height="2" />
          <rect x="5" y="5" width="6" height="2" />
          <rect x="5" y="7" width="8" height="2" />
        </svg>
      );
  }
}

export default function FloatingToolbox({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  palette,
  showCustomColor = false,
  eraseMode = "point",
  onEraseModeChange,
  eraserEnabled = false,
  privateEnabled = false,
  publishEnabled = false,
  reportEnabled = false,
  privateMode = "buy",
  onPrivateModeChange,
  exoticColors = [],
}: {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  palette: string[];
  showCustomColor?: boolean;
  eraseMode?: EraseMode;
  onEraseModeChange?: (mode: EraseMode) => void;
  eraserEnabled?: boolean;
  privateEnabled?: boolean;
  publishEnabled?: boolean;
  reportEnabled?: boolean;
  privateMode?: PrivateMode;
  onPrivateModeChange?: (mode: PrivateMode) => void;
  exoticColors?: { token: string; swatch: string; name: string }[];
}) {
  const { t } = useTranslation();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Detectar móvil
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Init position from localStorage or default (solo escritorio)
  useEffect(() => {
    const saved = localStorage.getItem("toolboxPosition");
    if (saved) {
      try {
        setPosition(JSON.parse(saved));
        return;
      } catch {}
    }
    setPosition({
      x: window.innerWidth / 2 - 110,
      y: window.innerHeight - 240,
    });
  }, []);

  // Save on every position update (cheap)
  useEffect(() => {
    if (position && !dragging) {
      localStorage.setItem("toolboxPosition", JSON.stringify(position));
    }
  }, [position, dragging]);

  // Drag handlers
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (clientX: number, clientY: number) => {
      setPosition({
        x: clientX - dragOffsetRef.current.x,
        y: clientY - dragOffsetRef.current.y,
      });
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => setDragging(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [dragging]);

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!position) return;
    dragOffsetRef.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    };
    setDragging(true);
  };

  // Contenido compartido (herramientas + paneles), reutilizado en ambos modos
  const colorDotBg = color.startsWith("#")
    ? color
    : (exoticColors.find((ec) => ec.token === color)?.swatch ?? color);

  const toolsContent = (
    <>
      <div className={styles.tools}>
        {(["brush", "eraser", "publish", "private", "report"] as Tool[]).map(
          (tool) => {
            const enabled =
              TOOL_ENABLED[tool] &&
              (tool !== "eraser" || eraserEnabled) &&
              (tool !== "private" || privateEnabled) &&
              (tool !== "publish" || publishEnabled) &&
              (tool !== "report" || reportEnabled);
            return (
              <button
                key={tool}
                className={`${styles.tool} ${activeTool === tool ? styles.toolActive : ""}`}
                onClick={() => enabled && onToolChange(tool)}
                disabled={!enabled}
              >
                <ToolIcon tool={tool} />
                <span className={styles.tooltip}>
                  {t(`toolbox.tools.${tool}`)}
                  {!TOOL_ENABLED[tool] ? ` ${t("toolbox.soon")}` : ""}
                  {tool === "eraser" && TOOL_ENABLED.eraser && !eraserEnabled
                    ? ` ${t("toolbox.loginRequired")}`
                    : ""}
                  {tool === "private" && TOOL_ENABLED.private && !privateEnabled
                    ? ` ${t("toolbox.loginRequired")}`
                    : ""}
                  {tool === "publish" && TOOL_ENABLED.publish && !publishEnabled
                    ? ` ${t("toolbox.loginRequired")}`
                    : ""}
                  {tool === "report" && TOOL_ENABLED.report && !reportEnabled
                    ? ` ${t("toolbox.loginRequired")}`
                    : ""}
                </span>
              </button>
            );
          },
        )}
      </div>

      {activeTool === "brush" && (
        <div className={styles.panel}>
          <div className={styles.paletteGrid}>
            {palette.map((c) => (
              <button
                key={c}
                className={`${styles.swatch} ${color === c ? styles.swatchActive : ""}`}
                style={{ background: c }}
                onClick={() => onColorChange(c)}
                aria-label={t("toolbox.colorAria", { color: c })}
              />
            ))}
          </div>

          {showCustomColor && (
            <div className={styles.customColorRow}>
              <input
                type="color"
                value={color.startsWith("#") ? color : "#000000"}
                onChange={(e) => onColorChange(e.target.value)}
              />
              <span className={styles.customLabel}>
                {t("toolbox.customColor")}
              </span>
            </div>
          )}

          {exoticColors.length > 0 && (
            <>
              <div className={styles.exoticLabel}>{t("toolbox.exotic")}</div>
              <div className={styles.paletteGrid}>
                {exoticColors.map((ec) => (
                  <button
                    key={ec.token}
                    className={`${styles.swatch} ${color === ec.token ? styles.swatchActive : ""}`}
                    style={{ background: ec.swatch }}
                    onClick={() => onColorChange(ec.token)}
                    title={ec.name}
                    aria-label={ec.name}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTool === "eraser" && (
        <div className={styles.panel}>
          <div className={styles.eraseModes}>
            <button
              className={`${styles.eraseModeBtn} ${eraseMode === "point" ? styles.eraseModeActive : ""}`}
              onClick={() => onEraseModeChange?.("point")}
            >
              {t("toolbox.erase.point")}
            </button>
            <button
              className={`${styles.eraseModeBtn} ${eraseMode === "area" ? styles.eraseModeActive : ""}`}
              onClick={() => onEraseModeChange?.("area")}
            >
              {t("toolbox.erase.area")}
            </button>
          </div>
          <p className={styles.eraseHint}>
            {eraseMode === "point"
              ? t("toolbox.erase.hintPoint")
              : t("toolbox.erase.hintArea")}
          </p>
        </div>
      )}

      {activeTool === "publish" && (
        <div className={styles.panel}>
          <p className={styles.eraseHint}>{t("toolbox.publish.hint")}</p>
        </div>
      )}

      {activeTool === "private" && (
        <div className={styles.panel}>
          <div className={styles.eraseModes}>
            <button
              className={`${styles.eraseModeBtn} ${privateMode === "buy" ? styles.eraseModeActive : ""}`}
              onClick={() => onPrivateModeChange?.("buy")}
            >
              {t("toolbox.private.buy")}
            </button>
            <button
              className={`${styles.eraseModeBtn} ${privateMode === "manage" ? styles.eraseModeActive : ""}`}
              onClick={() => onPrivateModeChange?.("manage")}
            >
              {t("toolbox.private.manage")}
            </button>
          </div>
          <p className={styles.eraseHint}>
            {privateMode === "buy"
              ? t("toolbox.private.hintBuy")
              : t("toolbox.private.hintManage")}
          </p>
        </div>
      )}

      {activeTool === "report" && (
        <div className={styles.panel}>
          <p className={styles.eraseHint}>{t("toolbox.report.hint")}</p>
        </div>
      )}
    </>
  );

  // Móvil: botón flotante que se expande
  if (isMobile) {
    return (
      <div className={styles.toolboxMobile}>
        {expanded && <div className={styles.mobilePanel}>{toolsContent}</div>}
        <button
          className={styles.mobileToggle}
          onClick={() => setExpanded((e) => !e)}
          aria-label={t("toolbox.toolsAria")}
        >
          <ToolIcon tool={activeTool} />
          <span
            className={styles.colorDot}
            style={{ background: colorDotBg }}
          />
        </button>
      </div>
    );
  }

  // Escritorio: toolbox flotante arrastrable
  if (!position) return null;

  return (
    <div
      className={styles.toolbox}
      style={{ left: position.x, top: position.y }}
    >
      <div
        className={styles.handle}
        onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          if (e.touches[0])
            handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
        }}
      >
        <div className={styles.handleDot} />
        <div className={styles.handleDot} />
        <div className={styles.handleDot} />
      </div>

      {toolsContent}
    </div>
  );
}
