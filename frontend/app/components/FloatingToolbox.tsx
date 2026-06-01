"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FloatingToolbox.module.css";

export type Tool = "brush" | "eraser" | "publish" | "private";

const TOOL_LABELS: Record<Tool, string> = {
  brush: "Pintar",
  eraser: "Borrar",
  publish: "Publicar",
  private: "Espacio privado",
};

const TOOL_ENABLED: Record<Tool, boolean> = {
  brush: true,
  eraser: false,
  publish: false,
  private: false,
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
  }
}

export default function FloatingToolbox({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  palette,
  showCustomColor = false,
}: {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  palette: string[];
  showCustomColor?: boolean;
}) {
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

  // Contenido compartido (herramientas + paleta), reutilizado en ambos modos
  const toolsContent = (
    <>
      <div className={styles.tools}>
        {(["brush", "eraser", "publish", "private"] as Tool[]).map((tool) => (
          <button
            key={tool}
            className={`${styles.tool} ${activeTool === tool ? styles.toolActive : ""}`}
            onClick={() => TOOL_ENABLED[tool] && onToolChange(tool)}
            disabled={!TOOL_ENABLED[tool]}
          >
            <ToolIcon tool={tool} />
            <span className={styles.tooltip}>
              {TOOL_LABELS[tool]}
              {!TOOL_ENABLED[tool] && " (próximamente)"}
            </span>
          </button>
        ))}
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
                aria-label={`Color ${c}`}
              />
            ))}
          </div>

          {showCustomColor && (
            <div className={styles.customColorRow}>
              <input
                type="color"
                value={color}
                onChange={(e) => onColorChange(e.target.value)}
              />
              <span className={styles.customLabel}>Color personalizado</span>
            </div>
          )}
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
          aria-label="Herramientas"
        >
          <ToolIcon tool={activeTool} />
          <span className={styles.colorDot} style={{ background: color }} />
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
