"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "./context/auth";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";
import FloatingToolbox, { type Tool } from "./components/FloatingToolbox";
import SideButtons, { type PanelSection } from "./components/SideButtons";
import SidePanel from "./components/SidePanel";
import MenuPanel from "./components/MenuPanel";
import { useSettings } from "./context/settings";
import SettingsPanel from "./components/SettingsPanel";
import BugReportView from "./components/BugReportView";

export default function Home() {
  const { token, nickname, logout } = useAuth();
  const tokenRef = useRef(token);

  const [clicksLeft, setClicksLeft] = useState(30);
  const [cooldown, setCooldown] = useState(0);
  const clicksRef = useRef(clicksLeft);
  const cooldownRef = useRef(cooldown);
  const { settings } = useSettings();
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const showCoordsRef = useRef(settings.showCoords);
  const [pixelOwners, setPixelOwners] = useState<Record<string, string>>({});
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    nickname: string;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelOwnersRef = useRef<Record<string, string>>({});
  const [selectedColor, setSelectedColor] = useState("#000000");
  const colorRef = useRef(selectedColor);
  const [panelSection, setPanelSection] = useState<PanelSection | null>(null);
  const [pixels, setPixels] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("pixels");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [zoom, setZoom] = useState(10);
  const [userTier, setUserTier] = useState<"FREE" | "PLUS" | "PREMIUM">("FREE");
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>("brush");
  const pendingZoomRef = useRef<{
    canvasX: number;
    canvasY: number;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const zoomRef = useRef(zoom);
  const multiTouchRef = useRef(false);

  const selectionModeRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  const PALETTES: Record<"FREE" | "PLUS" | "PREMIUM", string[]> = {
    FREE: [
      "#000000",
      "#FFFFFF",
      "#888888",
      "#CCCCCC",
      "#FF0000",
      "#00CC00",
      "#0000FF",
      "#FFFF00",
      "#FF8800",
      "#FF00FF",
      "#00FFFF",
      "#884400",
      "#FF88BB",
      "#8800FF",
      "#88FF44",
      "#00AAFF",
    ],
    PLUS: [
      "#000000",
      "#222222",
      "#444444",
      "#666666",
      "#888888",
      "#AAAAAA",
      "#CCCCCC",
      "#FFFFFF",
      "#550000",
      "#AA0000",
      "#FF0000",
      "#FF5555",
      "#FF8800",
      "#FFAA00",
      "#FFFF00",
      "#FFFF88",
      "#005500",
      "#00AA00",
      "#00FF00",
      "#88FF88",
      "#00AAAA",
      "#00FFFF",
      "#88FFFF",
      "#0055FF",
      "#0000FF",
      "#5555FF",
      "#8800FF",
      "#FF00FF",
      "#FF88FF",
      "#FF88BB",
      "#552200",
      "#884400",
    ],
    PREMIUM: [
      "#000000",
      "#222222",
      "#444444",
      "#666666",
      "#888888",
      "#AAAAAA",
      "#CCCCCC",
      "#FFFFFF",
      "#550000",
      "#AA0000",
      "#FF0000",
      "#FF5555",
      "#FF8800",
      "#FFAA00",
      "#FFFF00",
      "#FFFF88",
      "#005500",
      "#00AA00",
      "#00FF00",
      "#88FF88",
      "#00AAAA",
      "#00FFFF",
      "#88FFFF",
      "#0055FF",
      "#0000FF",
      "#5555FF",
      "#8800FF",
      "#FF00FF",
      "#FF88FF",
      "#FF88BB",
      "#552200",
      "#884400",
    ],
  };
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(() => {
    colorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = 1000;
    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const handleClick = (event: MouseEvent) => {
      if (multiTouchRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((event.clientX - rect.left) * scaleX);
      const y = Math.floor((event.clientY - rect.top) * scaleY);
      const key = `${x},${y}`;

      if (event.ctrlKey && pixelOwnersRef.current[key]) {
        routerRef.current.push(`/profile/${pixelOwnersRef.current[key]}`);
        return;
      }

      if (selectionModeRef.current) return;
      if (cooldownRef.current > 0) return;
      if (clicksRef.current <= 0) return;

      ctx.fillStyle = colorRef.current;
      ctx.fillRect(x, y, 1, 1);

      const color = colorRef.current;
      setPixels((prev) => ({ ...prev, [key]: color }));
      setClicksLeft((prev) => {
        const newValue = Math.max(prev - 1, 0);
        if (newValue <= 0) setCooldown(3 * 60 * 60);
        return newValue;
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (tokenRef.current)
        headers["Authorization"] = `Bearer ${tokenRef.current}`;

      fetch("http://localhost:3001/pixel", {
        method: "POST",
        headers,
        body: JSON.stringify({ x, y, color }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!data.success) {
            setPixels((prev) => {
              const reverted = { ...prev };
              delete reverted[key];
              return reverted;
            });
            setClicksLeft((prev) => prev + 1);
            if (data.cooldownSeconds > 0) setCooldown(data.cooldownSeconds);
            return;
          }
          if (data.state) {
            if (data.state.isAdmin || data.state.pixelsLeft === null) {
              setClicksLeft(Infinity);
            } else {
              setClicksLeft(data.state.pixelsLeft);
              if (data.state.cooldownSeconds > 0)
                setCooldown(data.state.cooldownSeconds);
            }
          }
        })
        .catch(() => {
          setPixels((prev) => {
            const reverted = { ...prev };
            delete reverted[key];
            return reverted;
          });
          setClicksLeft((prev) => prev + 1);
          console.error("Error al guardar el pixel, se revirtió el cambio.");
        });
    };

    canvas.addEventListener("click", handleClick);

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const mouseX = event.clientX - containerRect.left;
      const mouseY = event.clientY - containerRect.top;
      setZoom((prev) => {
        const factor = Math.exp(-event.deltaY * 0.001);
        const minZoom = Math.max(
          1,
          window.innerWidth / 1000,
          window.innerHeight / 1000,
        );
        const newZoom = Math.max(minZoom, Math.min(prev * factor, 40));
        const canvasX = (container.scrollLeft + mouseX) / prev;
        const canvasY = (container.scrollTop + mouseY) / prev;
        pendingZoomRef.current = { canvasX, canvasY, mouseX, mouseY };
        return newZoom;
      });
    };
    canvas.addEventListener("wheel", handleWheel);

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((event.clientX - rect.left) * scaleX);
      const y = Math.floor((event.clientY - rect.top) * scaleY);

      if (showCoordsRef.current) {
        setCursorPos({ x, y });
      }

      if (selectionModeRef.current && selectionStartRef.current) {
        const start = selectionStartRef.current;
        setSelection({
          x1: Math.min(start.x, x),
          y1: Math.min(start.y, y),
          x2: Math.max(start.x, x),
          y2: Math.max(start.y, y),
        });
        return;
      }
      if (selectionModeRef.current) {
        setTooltip(null);
        return;
      }
      const key = `${x},${y}`;
      if (pixelOwnersRef.current[key]) {
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          nickname: pixelOwnersRef.current[key],
        });
      } else {
        setTooltip(null);
      }
    };

    const handleSelectionMouseDown = (event: MouseEvent) => {
      if (!selectionModeRef.current) return;
      if (event.button !== 0) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((event.clientX - rect.left) * scaleX);
      const y = Math.floor((event.clientY - rect.top) * scaleY);
      selectionStartRef.current = { x, y };
      setSelection({ x1: x, y1: y, x2: x, y2: y });
    };

    const handleSelectionMouseUp = () => {
      if (!selectionModeRef.current) return;
      selectionStartRef.current = null;
    };

    canvas.addEventListener("mousedown", handleSelectionMouseDown);
    canvas.addEventListener("mouseup", handleSelectionMouseUp);
    canvas.addEventListener("mousemove", handleMouseMove);

    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleSelectionMouseDown);
      canvas.removeEventListener("mouseup", handleSelectionMouseUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const key in pixels) {
      const [x, y] = key.split(",").map(Number);
      ctx.fillStyle = pixels[key];
      ctx.fillRect(x, y, 1, 1);
    }
  }, [pixels, zoom]);

  useEffect(() => {
    localStorage.setItem("pixels", JSON.stringify(pixels));
  }, [pixels]);

  useEffect(() => {
    const loadPixels = async () => {
      const res = await fetch("http://localhost:3001/pixels");
      const data = await res.json();
      setPixels(data.colors);
      setPixelOwners(data.owners);
    };
    loadPixels();
  }, []);

  useEffect(() => {
    if (!token) {
      setUserTier("FREE");
      setIsAdmin(false);
      fetch("http://localhost:3001/anonymous-state")
        .then((res) => res.json())
        .then((data) => {
          setClicksLeft(data.pixelsLeft);
          setCooldown(data.cooldownSeconds);
        });
      return;
    }

    const fetchUserState = async () => {
      const res = await fetch("http://localhost:3001/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.banned) {
        router.push("/banned");
        return;
      }
      if (!data.verified && !data.isAdmin) {
        router.push("/verify");
        return;
      }

      if (data.isAdmin) {
        setIsAdmin(true);
        setClicksLeft(Infinity);
        setCooldown(0);
        setUserTier("PREMIUM");
      } else {
        setIsAdmin(false);
        if (data.pixelsLeft === null) {
          setClicksLeft(Infinity);
          setCooldown(0);
        } else {
          setClicksLeft(data.pixelsLeft);
          setCooldown(data.cooldownSeconds ?? 0);
        }
        setUserTier(data.subscriptionTier ?? "FREE");
      }
    };

    fetchUserState();
  }, [router, token]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let isDragging = false;
    let startX = 0,
      startY = 0,
      scrollLeft = 0,
      scrollTop = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      isDragging = true;
      container.style.cursor = "grabbing";
      startX = e.pageX;
      startY = e.pageY;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.pageX - startX;
      const dy = e.pageY - startY;
      container.scrollLeft = scrollLeft - dx;
      container.scrollTop = scrollTop - dy;
    };
    const onMouseUp = () => {
      isDragging = false;
      container.style.cursor = "grab";
    };
    const disableContextMenu = (e: MouseEvent) => e.preventDefault();

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("contextmenu", disableContextMenu);

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("contextmenu", disableContextMenu);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (tokenRef.current) {
            fetch("http://localhost:3001/auth/me", {
              headers: { Authorization: `Bearer ${tokenRef.current}` },
            })
              .then((res) => res.json())
              .then((data) => {
                if (data.isAdmin || data.pixelsLeft === null) {
                  setClicksLeft(Infinity);
                } else {
                  setClicksLeft(data.pixelsLeft);
                }
              });
          } else {
            setClicksLeft(30);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  useEffect(() => {
    clicksRef.current = clicksLeft;
  }, [clicksLeft]);
  useEffect(() => {
    cooldownRef.current = cooldown;
  }, [cooldown]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    showCoordsRef.current = settings.showCoords;
  }, [settings.showCoords]);

  useEffect(() => {
    const clampZoom = () => {
      const minZoom = Math.max(
        1,
        window.innerWidth / 1000,
        window.innerHeight / 1000,
      );
      setZoom((prev) => Math.max(prev, minZoom));
    };
    clampZoom();
    window.addEventListener("resize", clampZoom);
    return () => window.removeEventListener("resize", clampZoom);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let pinchStartDist = 0;
    let pinchStartZoom = 0;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const getDist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        multiTouchRef.current = true;
        if (resetTimer) {
          clearTimeout(resetTimer);
          resetTimer = null;
        }
        pinchStartDist = getDist(e.touches);
        pinchStartZoom = zoomRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault(); // evita el scroll nativo durante el pellizco
        const dist = getDist(e.touches);
        if (pinchStartDist === 0) {
          pinchStartDist = dist;
          return;
        }
        const ratio = dist / pinchStartDist;
        const rect = container.getBoundingClientRect();
        const midX =
          (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY =
          (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        setZoom((prev) => {
          const minZoom = Math.max(
            1,
            window.innerWidth / 1000,
            window.innerHeight / 1000,
          );
          const newZoom = Math.max(
            minZoom,
            Math.min(pinchStartZoom * ratio, 40),
          );
          const canvasX = (container.scrollLeft + midX) / prev;
          const canvasY = (container.scrollTop + midY) / prev;
          pendingZoomRef.current = {
            canvasX,
            canvasY,
            mouseX: midX,
            mouseY: midY,
          };
          return newZoom;
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        pinchStartDist = 0;
        // mantener el bloqueo un instante para ignorar el click sintético tras el pellizco
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          multiTouchRef.current = false;
          resetTimer = null;
        }, 350);
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, []);

  useEffect(() => {
    const socket = io("http://localhost:3001");
    socket.on(
      "pixel",
      (data: {
        x: number;
        y: number;
        color: string;
        nickname: string | null;
      }) => {
        const key = `${data.x},${data.y}`;
        setPixels((prev) => ({ ...prev, [key]: data.color }));
        if (data.nickname) {
          setPixelOwners((prev) => ({ ...prev, [key]: data.nickname! }));
        }
      },
    );
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    pixelOwnersRef.current = pixelOwners;
  }, [pixelOwners]);
  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  const handlePublish = async () => {
    if (!selection || !token) return;
    setPublishing(true);
    setPublishError("");
    try {
      const res = await fetch("http://localhost:3001/publications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: publishTitle || undefined,
          x1: selection.x1,
          y1: selection.y1,
          x2: selection.x2,
          y2: selection.y2,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al publicar");
      setShowPublishModal(false);
      setSelectionMode(false);
      setSelection(null);
      setPublishTitle("");
      alert("¡Publicación creada exitosamente!");
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Error al publicar");
    } finally {
      setPublishing(false);
    }
  };

  useLayoutEffect(() => {
    if (!pendingZoomRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const { canvasX, canvasY, mouseX, mouseY } = pendingZoomRef.current;
    container.scrollLeft = canvasX * zoom - mouseX;
    container.scrollTop = canvasY * zoom - mouseY;
    pendingZoomRef.current = null;
  }, [zoom]);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      {/* Contenedor del lienzo a pantalla completa */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "auto",
          cursor: "grab",
          touchAction: "pan-x pan-y",
          overscrollBehavior: "contain",
        }}
      >
        <div
          style={{
            position: "relative",
            width: `${1000 * zoom}px`,
            height: `${1000 * zoom}px`,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: `${1000 * zoom}px`,
              height: `${1000 * zoom}px`,
              imageRendering: "pixelated",
              display: "block",
              background: "#fff",
            }}
          />
          {zoom >= settings.gridThreshold && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                backgroundImage: `
                  linear-gradient(to right, rgba(0,0,0,0.15) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.15) 1px, transparent 1px)
                `,
                backgroundSize: `${zoom}px ${zoom}px`,
              }}
            />
          )}
          {selection && (
            <div
              style={{
                position: "absolute",
                left: `${selection.x1 * zoom}px`,
                top: `${selection.y1 * zoom}px`,
                width: `${(selection.x2 - selection.x1 + 1) * zoom}px`,
                height: `${(selection.y2 - selection.y1 + 1) * zoom}px`,
                border: "2px solid var(--color-brand)",
                background: "rgba(255, 122, 26, 0.15)",
                pointerEvents: "none",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>
      </div>

      {/* Overlay esquina superior izquierda: info de píxeles */}
      <div style={overlayBox(16, 16, "left")}>
        <div style={{ fontSize: "var(--text-sm)" }}>
          <span style={{ color: "var(--color-text-secondary)" }}>
            Píxeles:{" "}
          </span>
          <strong style={{ color: "var(--color-brand)" }}>
            {clicksLeft === Infinity ? "∞" : clicksLeft}
          </strong>
        </div>
        {cooldown > 0 && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-warning)",
              marginTop: "4px",
            }}
          >
            Cooldown: {Math.floor(cooldown / 60)}m {cooldown % 60}s
          </div>
        )}
      </div>

      {settings.showCoords && cursorPos && (
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            left: "16px",
            background: "var(--color-surface)",
            border: "var(--border-normal) solid var(--color-border-strong)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--text-sm)",
            zIndex: 30,
          }}
        >
          X: {cursorPos.x} · Y: {cursorPos.y}
        </div>
      )}

      {/* Overlay centro arriba: controles de publicación (temporal) */}
      {nickname && (
        <div style={overlayBoxCenter}>
          {!selectionMode ? (
            <button onClick={() => setSelectionMode(true)} style={navButton}>
              Publicar creación
            </button>
          ) : (
            <>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {selection
                  ? `${selection.x2 - selection.x1 + 1} × ${selection.y2 - selection.y1 + 1}`
                  : "Arrastra sobre el lienzo"}
              </span>
              <button
                onClick={() => setShowPublishModal(true)}
                disabled={!selection}
                style={navButton}
              >
                Publicar
              </button>
              <button
                onClick={() => {
                  setSelectionMode(false);
                  setSelection(null);
                }}
                style={navButton}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}

      {/* Caja de herramientas flotante */}
      <FloatingToolbox
        activeTool={activeTool}
        onToolChange={setActiveTool}
        color={selectedColor}
        onColorChange={setSelectedColor}
        palette={PALETTES[userTier]}
        showCustomColor={userTier === "PREMIUM" || isAdmin}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            top: tooltip.y + 12,
            left: tooltip.x + 12,
            background: "var(--color-bg)",
            color: "var(--color-text)",
            border: "var(--border-thin) solid var(--color-border-strong)",
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-xs)",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          {tooltip.nickname}
          <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "2px" }}>
            Ctrl+Clic para ver perfil
          </div>
        </div>
      )}

      {/* Modal de publicación */}
      {showPublishModal && selection && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-overlay)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              background: "var(--color-surface)",
              padding: "var(--space-6)",
              borderRadius: "var(--radius-lg)",
              border: "var(--border-normal) solid var(--color-border-strong)",
              maxWidth: "400px",
              width: "90%",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Publicar creación</h2>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-secondary)",
              }}
            >
              Área: {selection.x2 - selection.x1 + 1} ×{" "}
              {selection.y2 - selection.y1 + 1} píxeles
            </p>
            <input
              type="text"
              placeholder="Título (opcional, máx 60)"
              maxLength={60}
              value={publishTitle}
              onChange={(e) => setPublishTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "12px",
                boxSizing: "border-box",
              }}
            />
            {publishError && (
              <p
                style={{
                  color: "var(--color-danger)",
                  fontSize: "var(--text-sm)",
                  marginTop: 0,
                }}
              >
                {publishError}
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowPublishModal(false);
                  setPublishError("");
                }}
                style={{ padding: "8px 16px", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                style={{
                  padding: "8px 16px",
                  cursor: publishing ? "not-allowed" : "pointer",
                }}
              >
                {publishing ? "Publicando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <SideButtons
        activeSection={panelSection}
        onSelect={(s) => setPanelSection((prev) => (prev === s ? null : s))}
        panelOpen={panelSection !== null}
      />

      <SidePanel
        open={panelSection !== null}
        title={
          panelSection === "menu"
            ? "Menú"
            : panelSection === "settings"
              ? "Configuración"
              : panelSection === "achievements"
                ? "Logros"
                : panelSection === "tasks"
                  ? "Tareas semanales"
                  : panelSection === "bug"
                    ? "Reportar bug"
                    : ""
        }
        onClose={() => setPanelSection(null)}
      >
        {panelSection === "menu" && (
          <MenuPanel
            nickname={nickname}
            userTier={userTier}
            isAdmin={isAdmin}
            onLogout={() => {
              logout();
              setPanelSection(null);
            }}
            onNavigate={(path) => router.push(path)}
            onClose={() => setPanelSection(null)}
          />
        )}
        {panelSection === "settings" && (
          <SettingsPanel
            palette={PALETTES[userTier]}
            showCustomColor={userTier === "PREMIUM" || isAdmin}
          />
        )}
        {panelSection === "achievements" && (
          <p style={{ color: "var(--color-text-secondary)" }}>
            Logros próximamente.
          </p>
        )}
        {panelSection === "tasks" && (
          <p style={{ color: "var(--color-text-secondary)" }}>
            Tareas semanales próximamente.
          </p>
        )}
        {panelSection === "bug" && <BugReportView />}
      </SidePanel>
    </main>
  );
}

// ============ Estilos auxiliares para overlays ============

function overlayBox(
  top: number,
  sideValue: number,
  side: "left" | "right",
): React.CSSProperties {
  return {
    position: "absolute",
    top: `${top}px`,
    [side]: `${sideValue}px`,
    background: "var(--color-surface)",
    border: "var(--border-normal) solid var(--color-border-strong)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-2) var(--space-3)",
    boxShadow: "var(--shadow-soft-md)",
    zIndex: 30,
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
  };
}

const overlayBoxCenter: React.CSSProperties = {
  position: "absolute",
  top: "16px",
  left: "50%",
  transform: "translateX(-50%)",
  background: "var(--color-surface)",
  border: "var(--border-normal) solid var(--color-border-strong)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-2) var(--space-3)",
  boxShadow: "var(--shadow-soft-md)",
  zIndex: 30,
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
};

const navLink: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-text)",
};

const navButton: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  background: "transparent",
  border: "none",
  color: "var(--color-text)",
  padding: "4px 8px",
};
