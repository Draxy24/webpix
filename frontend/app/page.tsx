"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./context/auth";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";
import FloatingToolbox, {
  type Tool,
  type EraseMode,
  type PrivateMode,
} from "./components/FloatingToolbox";
import SideButtons, { type PanelSection } from "./components/SideButtons";
import SidePanel from "./components/SidePanel";
import MenuPanel from "./components/MenuPanel";
import { useSettings } from "./context/settings";
import SettingsPanel from "./components/SettingsPanel";
import BugReportView from "./components/BugReportView";
import PrivateSpacesView from "./components/PrivateSpacesView";
import AchievementsView from "./components/AchievementsView";
import WeeklyTasksView from "./components/WeeklyTasksView";
import { useProfileModal } from "./components/ProfileModalContext";
import { useShopModal } from "./components/ShopModalContext";
import { resolveColor } from "./lib/colors";
import { useNotify } from "./components/NotificationProvider";
import { API_URL } from "@/app/lib/api";
import Flag from "./components/Flag";
import { badgeIcon } from "./lib/badges";
import { cosmeticName } from "./lib/cosmeticText";
import { apiErrorText } from "./lib/apiError";
import {
  playPaint,
  playError,
  playErase,
  playPurchase,
  playPublish,
  playNav,
} from "./lib/sounds";
import ReportModal from "./components/ReportModal";
import { useTranslation } from "react-i18next";
import CommunityView from "./components/CommunityView";
import {
  eventToast,
  handleSocketNotification,
  type SocketNotification,
} from "./lib/rewardToast";

function formatPeriod(period: string, lang: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
      {/* Arco del candado: cerrado = baja y cierra; abierto = levantado y desplazado */}
      {locked ? (
        <>
          <rect x="5" y="2" width="6" height="2" />
          <rect x="5" y="4" width="2" height="3" />
          <rect x="9" y="4" width="2" height="3" />
        </>
      ) : (
        <>
          <rect x="7" y="1" width="6" height="2" />
          <rect x="7" y="3" width="2" height="4" />
          <rect x="11" y="3" width="2" height="2" />
        </>
      )}
      {/* Cuerpo del candado (igual en ambos estados) */}
      <rect x="3" y="7" width="10" height="7" />
      {/* Ojo de la cerradura, en hueco (color de fondo) */}
      <rect x="7" y="9" width="2" height="3" fill="var(--color-surface)" />
    </svg>
  );
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const { success, error, reward, info } = useNotify();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const rewardRef = useRef(reward);
  useEffect(() => {
    rewardRef.current = reward;
  }, [reward]);
  const infoRef = useRef(info);
  useEffect(() => {
    infoRef.current = info;
  }, [info]);
  const { token, nickname, logout } = useAuth();
  const { openProfile } = useProfileModal();
  const { openShop } = useShopModal();
  const tokenRef = useRef(token);
  const openProfileRef = useRef(openProfile);

  const [clicksLeft, setClicksLeft] = useState(30);
  const [cooldown, setCooldown] = useState(0);
  const clicksRef = useRef(clicksLeft);
  const cooldownRef = useRef(cooldown);
  const { settings } = useSettings();
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const showCoordsRef = useRef(settings.showCoords);
  const soundEnabledRef = useRef(settings.soundEnabled);
  const [pixelOwners, setPixelOwners] = useState<Record<string, string>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    nickname: string;
  } | null>(null);
  type OwnerCard = {
    country: string | null;
    level: number | null;
    title: {
      key: string;
      name: string;
      data: { color?: string } | null;
    } | null;
    badge: {
      key: string;
      name: string;
      data: { icon?: string; medal?: string; color?: string } | null;
    } | null;
  };
  const [ownerCards, setOwnerCards] = useState<Record<string, OwnerCard>>({});
  const ownerCardsRef = useRef<Record<string, OwnerCard>>({});
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
  const [eraseMode, setEraseMode] = useState<EraseMode>("point");
  const [privateMode, setPrivateMode] = useState<PrivateMode>("buy");
  const [showManageModal, setShowManageModal] = useState(false);
  const [erasingArea, setErasingArea] = useState(false);
  type PrivateSpaceBox = {
    id: number;
    name: string | null;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    accessMode: string;
    owner: string;
  };
  const [privateSpaces, setPrivateSpaces] = useState<PrivateSpaceBox[]>([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [accessMode, setAccessMode] = useState<
    "OWNER_ONLY" | "FRIENDS" | "SPECIFIC"
  >("OWNER_ONLY");
  const [memberInput, setMemberInput] = useState("");
  const [quote, setQuote] = useState<{
    pixels: number;
    monthlyBits: number;
  } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [notice, setNotice] = useState("");
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
  const [showReportModal, setShowReportModal] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [capReached, setCapReached] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [waitlist, setWaitlist] = useState<{
    inQueue: boolean;
    position?: number;
    claimActive?: boolean;
    claimExpiresAt?: string | null;
    desiredPixels?: number;
  } | null>(null);
  const [exoticColors, setExoticColors] = useState<
    { key: string; token: string; swatch: string; name: string }[]
  >([]);
  const [colorRefresh, setColorRefresh] = useState(0);
  const zoomRef = useRef(zoom);
  const multiTouchRef = useRef(false);
  const [gestureLock, setGestureLock] = useState(false);
  const gestureLockRef = useRef(false);

  const selectionModeRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeToolRef = useRef(activeTool);
  const pixelsRef = useRef(pixels);
  const nicknameRef = useRef(nickname);
  const isAdminRef = useRef(isAdmin);
  const [highlightZone, setHighlightZone] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const didJumpRef = useRef(false);

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

    const eraseAtPoint = (x: number, y: number, key: string) => {
      if (!tokenRef.current) return; // borrar requiere sesión

      const owner = pixelOwnersRef.current[key];
      // Solo borras lo tuyo (los admins pueden borrar cualquiera)
      if (!isAdminRef.current && owner !== nicknameRef.current) return;

      const prevColor = pixelsRef.current[key];
      if (!prevColor) return; // nada que borrar localmente

      // Optimista: quita el píxel y su dueño
      setPixels((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setPixelOwners((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (soundEnabledRef.current) playErase();

      fetch(API_URL + "/erase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ x, y }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!data.success) {
            setPixels((prev) => ({ ...prev, [key]: prevColor }));
            if (owner) setPixelOwners((prev) => ({ ...prev, [key]: owner }));
            return;
          }
          if (
            data.state &&
            !data.state.isAdmin &&
            data.state.pixelsLeft !== null
          ) {
            setClicksLeft(data.state.pixelsLeft);
            if (data.state.cooldownSeconds > 0)
              setCooldown(data.state.cooldownSeconds);
          }
        })
        .catch(() => {
          setPixels((prev) => ({ ...prev, [key]: prevColor }));
          if (owner) setPixelOwners((prev) => ({ ...prev, [key]: owner }));
        });
    };

    const handleClick = (event: MouseEvent) => {
      if (multiTouchRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((event.clientX - rect.left) * scaleX);
      const y = Math.floor((event.clientY - rect.top) * scaleY);
      const key = `${x},${y}`;

      if (event.ctrlKey && pixelOwnersRef.current[key]) {
        openProfileRef.current(pixelOwnersRef.current[key]);
        return;
      }

      if (selectionModeRef.current) return;
      if (activeToolRef.current === "eraser") {
        eraseAtPoint(x, y, key);
        return;
      }
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
        const dir = event.deltaY < 0 ? 1 : -1; // arriba acerca, abajo aleja
        const next = clampZoomInt(prev + dir);
        if (next === prev) return prev; // ya en el tope: no recolocar
        const canvasX = (container.scrollLeft + mouseX) / prev;
        const canvasY = (container.scrollTop + mouseY) / prev;
        pendingZoomRef.current = { canvasX, canvasY, mouseX, mouseY };
        return next;
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
      ctx.fillStyle = resolveColor(pixels[key], x, y);
      ctx.fillRect(x, y, 1, 1);
    }
    if (highlightZone) {
      const { x1, y1, x2, y2 } = highlightZone;
      const w = x2 - x1 + 1;
      const h = y2 - y1 + 1;
      ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
      ctx.fillRect(x1, y1, w, h);
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 1;
      ctx.strokeRect(x1 + 0.5, y1 + 0.5, w - 1, h - 1);
    }
  }, [pixels, zoom, highlightZone]);

  // Pintar con brocha arrastrando: junta celdas mientras mantienes el clic
  // izquierdo y las manda en tandas a /pixel-batch. Un clic suelto = tanda de 1.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dragging = false;
    let dragColor = "#000000";
    let lastCell: { x: number; y: number } | null = null;
    const triedThisDrag = new Set<string>(); // todas las celdas que tocó el arrastre
    const paintedThisDrag = new Set<string>(); // las que sí cupieron en la cuota
    let buffer: { x: number; y: number }[] = []; // pendientes de mandar al server
    let localBudget = Infinity; // presupuesto optimista (clicksLeft)
    let budgetHit = false;
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    let lastSoundAt = 0;

    const FLUSH_MS = 120;
    const MAX_PER_REQUEST = 200; // muy por debajo del cap de 500 del server

    const toCell = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: Math.floor((event.clientX - rect.left) * scaleX),
        y: Math.floor((event.clientY - rect.top) * scaleY),
      };
    };

    // Bresenham: rellena la línea entre dos puntos para que los arrastres
    // rápidos no dejen huecos.
    const lineCells = (x0: number, y0: number, x1: number, y1: number) => {
      const cells: { x: number; y: number }[] = [];
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      let cx = x0;
      let cy = y0;
      for (;;) {
        cells.push({ x: cx, y: cy });
        if (cx === x1 && cy === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          cx += sx;
        }
        if (e2 < dx) {
          err += dx;
          cy += sy;
        }
      }
      return cells;
    };

    const commitCells = (cands: { x: number; y: number }[]) => {
      const accepted: { x: number; y: number }[] = [];
      for (const c of cands) {
        if (c.x < 0 || c.x > 999 || c.y < 0 || c.y > 999) continue;
        const key = `${c.x},${c.y}`;
        if (triedThisDrag.has(key)) continue;
        triedThisDrag.add(key);
        if (localBudget <= 0) {
          budgetHit = true;
          continue; // contamos la celda como "intentada" pero ya no cabe
        }
        localBudget -= 1;
        paintedThisDrag.add(key);
        accepted.push(c);
        ctx.fillStyle = resolveColor(dragColor, c.x, c.y);
        ctx.fillRect(c.x, c.y, 1, 1);
      }
      if (accepted.length === 0) return;
      const now = Date.now();
      if (soundEnabledRef.current && now - lastSoundAt > 60) {
        playPaint();
        lastSoundAt = now;
      }
      for (const c of accepted) buffer.push(c);
      // Mergeamos al estado para que sobrevivan a redibujos (socket, zoom).
      setPixels((prev) => {
        const next = { ...prev };
        for (const c of accepted) next[`${c.x},${c.y}`] = dragColor;
        return next;
      });
    };

    const sendChunk = (cells: { x: number; y: number }[]) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (tokenRef.current)
        headers["Authorization"] = `Bearer ${tokenRef.current}`;

      fetch(API_URL + "/pixel-batch", {
        method: "POST",
        headers,
        body: JSON.stringify({ color: dragColor, cells }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!data.success) {
            setPixels((prev) => {
              const next = { ...prev };
              for (const c of cells) delete next[`${c.x},${c.y}`];
              return next;
            });
            if (data.cooldownSeconds > 0) setCooldown(data.cooldownSeconds);
            else if (data.message || data.code)
              setNotice(apiErrorText(data, tRef.current));
            return;
          }
          // Revertir solo lo que el server NO pintó (cuota o espacio privado).
          if (Array.isArray(data.skipped) && data.skipped.length > 0) {
            setPixels((prev) => {
              const next = { ...prev };
              for (const c of data.skipped) delete next[`${c.x},${c.y}`];
              return next;
            });
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
          if (Array.isArray(data.events)) {
            for (const ev of data.events)
              eventToast(ev, tRef.current, rewardRef.current);
          }
        })
        .catch(() => {
          setPixels((prev) => {
            const next = { ...prev };
            for (const c of cells) delete next[`${c.x},${c.y}`];
            return next;
          });
        });
    };

    const flush = (isFinal = false) => {
      if (buffer.length === 0) return;
      do {
        sendChunk(buffer.splice(0, MAX_PER_REQUEST));
      } while (isFinal && buffer.length > 0); // en el final, drena todo
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return; // solo clic izquierdo (el derecho hace pan)
      if (event.ctrlKey) return; // ctrl+clic = ver perfil (lo maneja el click)
      if (multiTouchRef.current) return;
      if (activeToolRef.current !== "brush") return;
      if (selectionModeRef.current) return;
      if (cooldownRef.current > 0) {
        if (soundEnabledRef.current) playError();
        return;
      }
      if (clicksRef.current <= 0) {
        if (soundEnabledRef.current) playError();
        return;
      }

      dragging = true;
      dragColor = colorRef.current;
      triedThisDrag.clear();
      paintedThisDrag.clear();
      buffer = [];
      budgetHit = false;
      localBudget =
        isAdminRef.current || clicksRef.current === Infinity
          ? Infinity
          : clicksRef.current;

      const { x, y } = toCell(event);
      lastCell = { x, y };
      commitCells([{ x, y }]);
      flushTimer = setInterval(() => flush(false), FLUSH_MS);
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!dragging) return;
      const { x, y } = toCell(event);
      if (lastCell && (lastCell.x !== x || lastCell.y !== y)) {
        const seg = lineCells(lastCell.x, lastCell.y, x, y).slice(1); // sin el inicio
        commitCells(seg);
        lastCell = { x, y };
      }
    };

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      lastCell = null;
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
      flush(true);
      if (budgetHit) {
        setNotice(
          tRef.current("canvas.drag.paintedXofY", {
            defaultValue: "Pinté {{x}} de {{y}} píxeles (límite alcanzado).",
            x: paintedThisDrag.size,
            y: triedThisDrag.size,
          }),
        );
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endDrag);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endDrag);
      if (flushTimer) clearInterval(flushTimer);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("pixels", JSON.stringify(pixels));
  }, [pixels]);

  useEffect(() => {
    const loadPixels = async () => {
      const res = await fetch(API_URL + "/pixels");
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
      fetch(API_URL + "/anonymous-state")
        .then((res) => res.json())
        .then((data) => {
          setClicksLeft(data.pixelsLeft);
          setCooldown(data.cooldownSeconds);
        });
      return;
    }

    const fetchUserState = async () => {
      const res = await fetch(API_URL + "/auth/me", {
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

  // Pan táctil de un dedo: tomamos control del desplazamiento para que la
  // diagonal sea fluida (el scroll nativo la descomponía en escalera).
  // Con lock activo NO hace pan (deja el dedo libre para pintar/seleccionar).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let panning = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    const onTouchStart = (e: TouchEvent) => {
      // Solo un dedo. Dos o más = pinch-zoom, no nos metemos.
      if (e.touches.length !== 1) {
        panning = false;
        return;
      }
      // Con lock activo, el dedo es para pintar/seleccionar, no para pan.
      if (gestureLockRef.current) return;

      panning = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startScrollLeft = container.scrollLeft;
      startScrollTop = container.scrollTop;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!panning) return;
      if (e.touches.length !== 1) {
        panning = false; // apareció un segundo dedo: cede al pinch
        return;
      }
      // Movemos el scroll nosotros, en ambos ejes a la vez (diagonal libre).
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      const maxL = Math.max(0, 1000 * zoomRef.current - container.clientWidth);
      const maxT = Math.max(0, 1000 * zoomRef.current - container.clientHeight);
      container.scrollLeft = Math.max(0, Math.min(startScrollLeft - dx, maxL));
      container.scrollTop = Math.max(0, Math.min(startScrollTop - dy, maxT));
      e.preventDefault(); // evita cualquier scroll nativo residual
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) panning = false;
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
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (tokenRef.current) {
            fetch(API_URL + "/auth/me", {
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
    openProfileRef.current = openProfile;
  }, [openProfile]);

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
    gestureLockRef.current = gestureLock;
  }, [gestureLock]);

  useEffect(() => {
    showCoordsRef.current = settings.showCoords;
  }, [settings.showCoords]);

  useEffect(() => {
    soundEnabledRef.current = settings.soundEnabled;
  }, [settings.soundEnabled]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const clampZoom = () => setZoom((prev) => clampZoomInt(prev));
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
        e.preventDefault();
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

        const prev = zoomRef.current;
        const next = clampZoomInt(pinchStartZoom * ratio);
        if (next === prev) return;

        // Punto del lienzo bajo el centro del pinch (antes de cambiar zoom)
        const canvasX = (container.scrollLeft + midX) / prev;
        const canvasY = (container.scrollTop + midY) / prev;

        // Aplicamos el zoom al estado...
        setZoom(next);
        zoomRef.current = next; // sincronizamos el ref de inmediato

        // ...y reposicionamos el scroll YA, sin esperar el ciclo de React.
        // El contenedor se redimensiona en el mismo frame al cambiar el ancho/alto
        // del hijo, así que clampeamos contra el nuevo tamaño.
        requestAnimationFrame(() => {
          const maxL = Math.max(0, 1000 * next - container.clientWidth);
          const maxT = Math.max(0, 1000 * next - container.clientHeight);
          container.scrollLeft = Math.max(
            0,
            Math.min(canvasX * next - midX, maxL),
          );
          container.scrollTop = Math.max(
            0,
            Math.min(canvasY * next - midY, maxT),
          );
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
    const socket = io(API_URL, { auth: token ? { token } : undefined });
    socket.on(
      "pixel-batch",
      (data: {
        pixels: {
          x: number;
          y: number;
          color: string;
          nickname: string | null;
        }[];
      }) => {
        setPixels((prev) => {
          const next = { ...prev };
          for (const p of data.pixels) next[`${p.x},${p.y}`] = p.color;
          return next;
        });
        setPixelOwners((prev) => {
          const next = { ...prev };
          for (const p of data.pixels) {
            if (p.nickname) next[`${p.x},${p.y}`] = p.nickname;
          }
          return next;
        });
      },
    );
    socket.on("erase", (data: { cells: { x: number; y: number }[] }) => {
      setPixels((prev) => {
        const next = { ...prev };
        for (const c of data.cells) delete next[`${c.x},${c.y}`];
        return next;
      });
      setPixelOwners((prev) => {
        const next = { ...prev };
        for (const c of data.cells) delete next[`${c.x},${c.y}`];
        return next;
      });
    });
    socket.on("notification", (payload: SocketNotification) => {
      handleSocketNotification(payload, tRef.current, {
        info: infoRef.current,
        reward: rewardRef.current,
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    pixelOwnersRef.current = pixelOwners;
  }, [pixelOwners]);
  useEffect(() => {
    ownerCardsRef.current = ownerCards;
  }, [ownerCards]);

  // Carga (con caché y pequeño debounce) la info del dueño bajo el cursor
  useEffect(() => {
    const nick = tooltip?.nickname;
    if (!nick || ownerCardsRef.current[nick]) return;
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`${API_URL}/users/${nick}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          setOwnerCards((prev) => ({
            ...prev,
            [nick]: {
              country: data.country ?? null,
              level: data.level ?? null,
              title: data.title ?? null,
              badge: data.badge ?? null,
            },
          }));
        })
        .catch(() => {});
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tooltip?.nickname]);
  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    pixelsRef.current = pixels;
  }, [pixels]);
  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  useEffect(() => {
    if (activeTool === "eraser" && eraseMode === "area") {
      setSelectionMode(true);
      setSelection(null);
    } else if (activeTool === "private" && privateMode === "buy") {
      setSelectionMode(true);
      setSelection(null);
    } else if (activeTool === "publish") {
      setSelectionMode(true);
      setSelection(null);
    } else if (activeTool === "report") {
      setSelectionMode(true);
      setSelection(null);
    } else {
      // brush, borrador en punto, o gestionar espacios: sin selección
      setSelectionMode(false);
      setSelection(null);
    }
  }, [activeTool, eraseMode, privateMode]);

  // Con LOCK ACTIVO, el dedo queda libre: pinta (pincel) o selecciona (área).
  // Reutiliza la misma lógica de píxeles/selección del escritorio.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toCell = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: Math.floor((touch.clientX - rect.left) * scaleX),
        y: Math.floor((touch.clientY - rect.top) * scaleY),
      };
    };

    // --- Estado del arrastre táctil (pincel) ---
    let painting = false;
    let dragColor = "#000000";
    let lastCell: { x: number; y: number } | null = null;
    const triedThisDrag = new Set<string>();
    const paintedThisDrag = new Set<string>();
    let buffer: { x: number; y: number }[] = [];
    let localBudget = Infinity;
    let budgetHit = false;
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    let lastSoundAt = 0;
    const FLUSH_MS = 120;
    const MAX_PER_REQUEST = 200;
    const ctx = canvas.getContext("2d");

    const lineCells = (x0: number, y0: number, x1: number, y1: number) => {
      const cells: { x: number; y: number }[] = [];
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      let cx = x0;
      let cy = y0;
      for (;;) {
        cells.push({ x: cx, y: cy });
        if (cx === x1 && cy === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          cx += sx;
        }
        if (e2 < dx) {
          err += dx;
          cy += sy;
        }
      }
      return cells;
    };

    const commitCells = (cands: { x: number; y: number }[]) => {
      if (!ctx) return;
      const accepted: { x: number; y: number }[] = [];
      for (const c of cands) {
        if (c.x < 0 || c.x > 999 || c.y < 0 || c.y > 999) continue;
        const key = `${c.x},${c.y}`;
        if (triedThisDrag.has(key)) continue;
        triedThisDrag.add(key);
        if (localBudget <= 0) {
          budgetHit = true;
          continue;
        }
        localBudget -= 1;
        paintedThisDrag.add(key);
        accepted.push(c);
        ctx.fillStyle = resolveColor(dragColor, c.x, c.y);
        ctx.fillRect(c.x, c.y, 1, 1);
      }
      if (accepted.length === 0) return;
      const now = Date.now();
      if (soundEnabledRef.current && now - lastSoundAt > 60) {
        playPaint();
        lastSoundAt = now;
      }
      for (const c of accepted) buffer.push(c);
      setPixels((prev) => {
        const next = { ...prev };
        for (const c of accepted) next[`${c.x},${c.y}`] = dragColor;
        return next;
      });
    };

    const sendChunk = (cells: { x: number; y: number }[]) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (tokenRef.current)
        headers["Authorization"] = `Bearer ${tokenRef.current}`;
      fetch(API_URL + "/pixel-batch", {
        method: "POST",
        headers,
        body: JSON.stringify({ color: dragColor, cells }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!data.success) {
            setPixels((prev) => {
              const next = { ...prev };
              for (const c of cells) delete next[`${c.x},${c.y}`];
              return next;
            });
            if (data.cooldownSeconds > 0) setCooldown(data.cooldownSeconds);
            else if (data.message || data.code)
              setNotice(apiErrorText(data, tRef.current));
            return;
          }
          if (Array.isArray(data.skipped) && data.skipped.length > 0) {
            setPixels((prev) => {
              const next = { ...prev };
              for (const c of data.skipped) delete next[`${c.x},${c.y}`];
              return next;
            });
          }
          if (data.state) {
            if (data.state.isAdmin || data.state.pixelsLeft === null)
              setClicksLeft(Infinity);
            else {
              setClicksLeft(data.state.pixelsLeft);
              if (data.state.cooldownSeconds > 0)
                setCooldown(data.state.cooldownSeconds);
            }
          }
          if (Array.isArray(data.events))
            for (const ev of data.events)
              eventToast(ev, tRef.current, rewardRef.current);
        })
        .catch(() => {
          setPixels((prev) => {
            const next = { ...prev };
            for (const c of cells) delete next[`${c.x},${c.y}`];
            return next;
          });
        });
    };

    const flush = (isFinal = false) => {
      if (buffer.length === 0) return;
      do {
        sendChunk(buffer.splice(0, MAX_PER_REQUEST));
      } while (isFinal && buffer.length > 0);
    };

    // --- touchstart ---
    const onTouchStart = (e: TouchEvent) => {
      if (!gestureLockRef.current) return; // sin lock: lo maneja el pan
      if (e.touches.length !== 1) return; // un dedo
      const touch = e.touches[0];
      const { x, y } = toCell(touch);

      // Modo selección: arrancar el rectángulo
      if (selectionModeRef.current) {
        selectionStartRef.current = { x, y };
        setSelection({ x1: x, y1: y, x2: x, y2: y });
        e.preventDefault();
        return;
      }

      // Modo pincel: arrancar el pintado
      if (activeToolRef.current === "brush") {
        if (cooldownRef.current > 0 || clicksRef.current <= 0) {
          if (soundEnabledRef.current) playError();
          return;
        }
        painting = true;
        dragColor = colorRef.current;
        triedThisDrag.clear();
        paintedThisDrag.clear();
        buffer = [];
        budgetHit = false;
        localBudget =
          isAdminRef.current || clicksRef.current === Infinity
            ? Infinity
            : clicksRef.current;
        lastCell = { x, y };
        commitCells([{ x, y }]);
        flushTimer = setInterval(() => flush(false), FLUSH_MS);
        e.preventDefault();
      }
    };

    // --- touchmove ---
    const onTouchMove = (e: TouchEvent) => {
      if (!gestureLockRef.current) return;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const { x, y } = toCell(touch);

      // Selección: actualizar el rectángulo
      if (selectionModeRef.current && selectionStartRef.current) {
        const start = selectionStartRef.current;
        setSelection({
          x1: Math.min(start.x, x),
          y1: Math.min(start.y, y),
          x2: Math.max(start.x, x),
          y2: Math.max(start.y, y),
        });
        e.preventDefault();
        return;
      }

      // Pincel: pintar la línea interpolada
      if (painting && lastCell && (lastCell.x !== x || lastCell.y !== y)) {
        const seg = lineCells(lastCell.x, lastCell.y, x, y).slice(1);
        commitCells(seg);
        lastCell = { x, y };
        e.preventDefault();
      }
    };

    // --- touchend ---
    const onTouchEnd = () => {
      if (selectionModeRef.current) {
        selectionStartRef.current = null;
        return;
      }
      if (painting) {
        painting = false;
        lastCell = null;
        if (flushTimer) {
          clearInterval(flushTimer);
          flushTimer = null;
        }
        flush(true);
        if (budgetHit) {
          setNotice(
            tRef.current("canvas.drag.paintedXofY", {
              defaultValue: "Pinté {{x}} de {{y}} píxeles (límite alcanzado).",
              x: paintedThisDrag.size,
              y: triedThisDrag.size,
            }),
          );
        }
      }
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      if (flushTimer) clearInterval(flushTimer);
    };
  }, []);

  // Cargar zonas privadas activas para dibujar sus bordes
  useEffect(() => {
    fetch(API_URL + "/private-spaces/canvas")
      .then((res) => res.json())
      .then((data) => setPrivateSpaces(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showPurchaseModal || !token) return;
    setCapReached(false);
    let cancelled = false;
    fetch(API_URL + "/private-spaces/waitlist/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setWaitlist(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showPurchaseModal, token]);

  // Cotiza el precio en Bits del área seleccionada al abrir el modal de compra
  useEffect(() => {
    if (!showPurchaseModal || !selection || !token) return;
    let cancelled = false;
    setQuote(null);
    setQuoteError("");
    (async () => {
      try {
        const res = await fetch(API_URL + "/private-spaces/quote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            x1: selection.x1,
            y1: selection.y1,
            x2: selection.x2,
            y2: selection.y2,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setQuoteError(
            apiErrorText(
              data,
              t,
              t("canvas.purchase.quoteError", {
                defaultValue: "No se pudo calcular el precio.",
              }),
            ),
          );
          return;
        }
        setQuote(data);
      } catch {
        if (!cancelled) {
          setQuoteError(
            t("canvas.purchase.quoteError", {
              defaultValue: "No se pudo calcular el precio.",
            }),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showPurchaseModal, selection, token]);

  useEffect(() => {
    if (!token) {
      setExoticColors([]);
      return;
    }
    fetch(API_URL + "/rewards/cosmetics", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(
        (
          data: {
            type: string;
            key: string;
            name: string;
            data: { token?: string; swatch?: string } | null;
          }[],
        ) => {
          setExoticColors(
            data
              .filter((c) => c.type === "COLOR" && c.data?.token)
              .map((c) => ({
                key: c.key,
                token: c.data!.token!,
                swatch: c.data!.swatch ?? "#000",
                name: c.name,
              })),
          );
        },
      )
      .catch(() => {});
  }, [token, colorRefresh]);

  useEffect(() => {
    const handler = () => setColorRefresh((n) => n + 1);
    window.addEventListener("cosmetics-updated", handler);
    return () => window.removeEventListener("cosmetics-updated", handler);
  }, []);

  // Auto-ocultar avisos
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  // Salta y hace zoom a una zona del lienzo, resaltándola unos segundos.
  const jumpToZone = useCallback(
    (rx1: number, ry1: number, rx2: number, ry2: number) => {
      const x1 = Math.max(0, Math.min(rx1, rx2));
      const y1 = Math.max(0, Math.min(ry1, ry2));
      const x2 = Math.min(999, Math.max(rx1, rx2));
      const y2 = Math.min(999, Math.max(ry1, ry2));

      const container = containerRef.current;
      if (!container) return;

      const zoneW = x2 - x1 + 1;
      const zoneH = y2 - y1 + 1;
      const minZoom = Math.max(
        1,
        window.innerWidth / 1000,
        window.innerHeight / 1000,
      );
      const fitZoom = clampZoomInt(
        Math.min(
          (container.clientWidth * 0.6) / zoneW,
          (container.clientHeight * 0.6) / zoneH,
        ),
      );

      const cx = (x1 + x2 + 1) / 2;
      const cy = (y1 + y2 + 1) / 2;

      setHighlightZone({ x1, y1, x2, y2 });
      setZoom(fitZoom);

      const centerOn = () => {
        const c = containerRef.current;
        if (!c) return;
        const maxL = 1000 * fitZoom - c.clientWidth;
        const maxT = 1000 * fitZoom - c.clientHeight;
        c.scrollLeft = Math.max(
          0,
          Math.min(cx * fitZoom - c.clientWidth / 2, maxL),
        );
        c.scrollTop = Math.max(
          0,
          Math.min(cy * fitZoom - c.clientHeight / 2, maxT),
        );
      };
      requestAnimationFrame(() => requestAnimationFrame(centerOn));

      setTimeout(() => setHighlightZone(null), 4000);
    },
    [],
  );

  const minZoomInt = () =>
    Math.max(
      1,
      Math.ceil(window.innerWidth / 1000),
      Math.ceil(window.innerHeight / 1000),
    );

  const clampZoomInt = (z: number) =>
    Math.max(minZoomInt(), Math.min(Math.round(z), 40));

  // Deep-link ?zone=x1_y1_x2_y2 (al cargar la página, p. ej. un enlace compartido)
  useEffect(() => {
    if (didJumpRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const zoneParam = params.get("zone");
    if (!zoneParam) return;

    const parts = zoneParam.split("_").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return;

    didJumpRef.current = true;
    jumpToZone(parts[0], parts[1], parts[2], parts[3]);

    const url = new URL(window.location.href);
    url.searchParams.delete("zone");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [jumpToZone]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API_URL + "/rankings/pending", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const pending: {
          period: string;
          bestPosition: number;
          totalBits: number;
        }[] = await res.json();
        if (cancelled || !Array.isArray(pending) || pending.length === 0)
          return;
        const periods: string[] = [];
        for (const p of pending) {
          periods.push(p.period);
          rewardRef.current(
            String(
              tRef.current("rankings.toast.title", {
                month: formatPeriod(p.period, i18n.language),
              }),
            ),
            String(
              tRef.current("rankings.toast.sub", {
                pos: p.bestPosition,
                bits: p.totalBits,
              }),
            ),
          );
        }
        await fetch(API_URL + "/rankings/pending/seen", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ periods }),
        });
      } catch {
        /* sin conexión: se reintenta en la próxima carga */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handlePublish = async () => {
    if (!selection || !token) return;
    setPublishing(true);
    setPublishError("");
    try {
      const res = await fetch(API_URL + "/publications", {
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
      if (!res.ok)
        throw new Error(apiErrorText(data, t, t("canvas.publish.error")));
      setShowPublishModal(false);
      setSelection(null);
      setPublishTitle("");
      if (soundEnabledRef.current) playPublish();
      success(t("canvas.publish.success"));
      if (Array.isArray(data.events)) {
        for (const ev of data.events) eventToast(ev, t, reward);
      }
    } catch (err) {
      setPublishError(
        err instanceof Error ? err.message : t("canvas.publish.error"),
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleEraseArea = async () => {
    if (!selection || !token) return;
    setErasingArea(true);
    try {
      const res = await fetch(API_URL + "/erase-area", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          x1: selection.x1,
          y1: selection.y1,
          x2: selection.x2,
          y2: selection.y2,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        error(apiErrorText(data, t, t("canvas.eraseArea.failed")));
        return;
      }
      // El evento 'erase' del WebSocket quita los píxeles del lienzo en todos.
      if (data.state && !data.state.isAdmin && data.state.pixelsLeft !== null) {
        setClicksLeft(data.state.pixelsLeft);
        if (data.state.cooldownSeconds > 0)
          setCooldown(data.state.cooldownSeconds);
      }
      setSelection(null);
      if (soundEnabledRef.current) playErase();
    } catch {
      error(t("canvas.eraseArea.connError"));
    } finally {
      setErasingArea(false);
    }
  };

  const handlePurchase = async () => {
    if (!selection || !token) return;
    setPurchasing(true);
    setPurchaseError("");
    setCapReached(false);
    try {
      const memberNicknames =
        accessMode === "SPECIFIC"
          ? memberInput
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;
      const res = await fetch(API_URL + "/private-spaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          x1: selection.x1,
          y1: selection.y1,
          x2: selection.x2,
          y2: selection.y2,
          accessMode,
          memberNicknames,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const code = data?.code ?? data?.message?.code;
        if (code === "SPACE_CAP_REACHED") {
          setCapReached(true); // muestra el flujo de lista de espera
          return;
        }
        throw new Error(apiErrorText(data, t, t("canvas.purchase.failed")));
      }
      const r = await fetch(API_URL + "/private-spaces/canvas");
      setPrivateSpaces(await r.json());
      setShowPurchaseModal(false);
      setSelection(null);
      setMemberInput("");
      setAccessMode("OWNER_ONLY");
      setWaitlist({ inQueue: false });
      if (soundEnabledRef.current) playPurchase();
      success(t("canvas.purchase.success"));
    } catch (err) {
      setPurchaseError(
        err instanceof Error ? err.message : t("canvas.purchase.genericError"),
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!selection || !token) return;
    setJoiningWaitlist(true);
    setPurchaseError("");
    try {
      const res = await fetch(API_URL + "/private-spaces/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          x1: selection.x1,
          y1: selection.y1,
          x2: selection.x2,
          y2: selection.y2,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          apiErrorText(
            data,
            t,
            t("canvas.waitlist.failed", { defaultValue: "No se pudo anotar." }),
          ),
        );
      }
      setWaitlist(data);
      setCapReached(false);
    } catch (err) {
      setPurchaseError(
        err instanceof Error ? err.message : t("canvas.purchase.genericError"),
      );
    } finally {
      setJoiningWaitlist(false);
    }
  };

  const handleLeaveWaitlist = async () => {
    if (!token) return;
    try {
      await fetch(API_URL + "/private-spaces/waitlist", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setWaitlist({ inQueue: false });
    } catch {}
  };

  useLayoutEffect(() => {
    if (!pendingZoomRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const { canvasX, canvasY, mouseX, mouseY } = pendingZoomRef.current;

    const maxL = Math.max(0, 1000 * zoom - container.clientWidth);
    const maxT = Math.max(0, 1000 * zoom - container.clientHeight);

    container.scrollLeft = Math.max(0, Math.min(canvasX * zoom - mouseX, maxL));
    container.scrollTop = Math.max(0, Math.min(canvasY * zoom - mouseY, maxT));
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
          touchAction: "none",
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
          {privateSpaces.map((sp) => (
            <div
              key={sp.id}
              style={{
                position: "absolute",
                left: `${sp.x1 * zoom}px`,
                top: `${sp.y1 * zoom}px`,
                width: `${(sp.x2 - sp.x1 + 1) * zoom}px`,
                height: `${(sp.y2 - sp.y1 + 1) * zoom}px`,
                border: "2px dashed #8B5CF6",
                background: "rgba(139, 92, 246, 0.08)",
                pointerEvents: "none",
                boxSizing: "border-box",
                zIndex: 5,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  transform: "translateY(-100%)",
                  background: "#8B5CF6",
                  color: "#fff",
                  fontSize: "10px",
                  padding: "1px 4px",
                  whiteSpace: "nowrap",
                  borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                }}
              >
                🔒 {sp.name || sp.owner}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Overlay esquina superior izquierda: info de píxeles */}
      <div style={overlayBox(16, 16, "left")}>
        <div style={{ fontSize: "var(--text-sm)" }}>
          <span style={{ color: "var(--color-text-secondary)" }}>
            {t("canvas.pixels")}{" "}
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
            {t("canvas.cooldown")} {Math.floor(cooldown / 60)}m {cooldown % 60}s
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

      {/* Centro arriba: publicar creación */}
      {nickname && activeTool === "publish" && (
        <div style={overlayBoxCenter}>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            {selection
              ? t("canvas.overlay.publishSize", {
                  w: selection.x2 - selection.x1 + 1,
                  h: selection.y2 - selection.y1 + 1,
                })
              : t("canvas.overlay.publishHint")}
          </span>
          <button
            onClick={() => setShowPublishModal(true)}
            disabled={!selection}
            style={navButton}
          >
            {t("canvas.overlay.publishBtn")}
          </button>
          {selection && (
            <button onClick={() => setSelection(null)} style={navButton}>
              {t("common.cancel")}
            </button>
          )}
        </div>
      )}

      {/* Centro arriba: borrador en área */}
      {nickname && activeTool === "eraser" && eraseMode === "area" && (
        <div style={overlayBoxCenter}>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            {selection
              ? t("canvas.overlay.eraseSize", {
                  w: selection.x2 - selection.x1 + 1,
                  h: selection.y2 - selection.y1 + 1,
                })
              : t("canvas.overlay.dragArea")}
          </span>
          <button
            onClick={handleEraseArea}
            disabled={!selection || erasingArea}
            style={navButton}
          >
            {erasingArea
              ? t("canvas.overlay.eraseBtnLoading")
              : t("canvas.overlay.eraseBtn")}
          </button>
          {selection && (
            <button onClick={() => setSelection(null)} style={navButton}>
              {t("common.cancel")}
            </button>
          )}
        </div>
      )}

      {/* Centro arriba: borrador en punto */}
      {nickname && activeTool === "eraser" && eraseMode === "point" && (
        <div style={overlayBoxCenter}>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            {t("canvas.overlay.erasePoint")}
          </span>
        </div>
      )}

      {/* Centro arriba: comprar espacio privado */}
      {nickname && activeTool === "private" && privateMode === "buy" && (
        <div style={overlayBoxCenter}>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            {selection
              ? t("canvas.overlay.privateSize", {
                  w: selection.x2 - selection.x1 + 1,
                  h: selection.y2 - selection.y1 + 1,
                })
              : t("canvas.overlay.dragArea")}
          </span>
          <button
            onClick={() => setShowPurchaseModal(true)}
            disabled={!selection}
            style={navButton}
          >
            {t("canvas.overlay.privateBtn")}
          </button>
          {selection && (
            <button onClick={() => setSelection(null)} style={navButton}>
              {t("common.cancel")}
            </button>
          )}
        </div>
      )}

      {/* Centro arriba: reportar zona */}
      {nickname && activeTool === "report" && (
        <div style={overlayBoxCenter}>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            {selection
              ? t("canvas.overlay.reportSize", {
                  w: selection.x2 - selection.x1 + 1,
                  h: selection.y2 - selection.y1 + 1,
                })
              : t("canvas.overlay.reportHint")}
          </span>
          <button
            onClick={() => setShowReportModal(true)}
            disabled={!selection}
            style={navButton}
          >
            {t("canvas.overlay.reportBtn")}
          </button>
          {selection && (
            <button onClick={() => setSelection(null)} style={navButton}>
              {t("common.cancel")}
            </button>
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
        exoticColors={exoticColors}
        showCustomColor={userTier === "PREMIUM" || isAdmin}
        eraseMode={eraseMode}
        onEraseModeChange={setEraseMode}
        eraserEnabled={!!nickname}
        privateEnabled={!!nickname}
        publishEnabled={!!nickname}
        reportEnabled={!!nickname}
        privateMode={privateMode}
        onPrivateModeChange={(mode) => {
          setPrivateMode(mode);
          if (mode === "manage") setShowManageModal(true);
        }}
      />

      {/* Botón de candado (lock de gesto) — solo móvil */}
      {isMobile && (
        <button
          onClick={() => setGestureLock((v) => !v)}
          onTouchEnd={(e) => {
            e.preventDefault(); // evita el click sintético duplicado
            e.stopPropagation(); // que el toque no llegue a los handlers del lienzo
            setGestureLock((v) => !v);
          }}
          aria-label={
            gestureLock
              ? t("canvas.lock.unlock", {
                  defaultValue: "Desbloquear pantalla",
                })
              : t("canvas.lock.lock", { defaultValue: "Bloquear pantalla" })
          }
          style={{
            position: "fixed",
            bottom: "24px",
            left: "24px",
            zIndex: 40,
            width: "52px",
            height: "52px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-md)",
            border: `var(--border-normal) solid ${
              gestureLock ? "var(--color-brand)" : "var(--color-border-strong)"
            }`,
            background: gestureLock
              ? "var(--color-elevated)"
              : "var(--color-surface)",
            color: gestureLock ? "var(--color-brand)" : "var(--color-text)",
            boxShadow: "var(--shadow-soft-md)",
            cursor: "pointer",
            touchAction: "manipulation",
          }}
        >
          <LockIcon locked={gestureLock} />
        </button>
      )}

      {/* Tooltip */}
      {tooltip &&
        (() => {
          const card = ownerCards[tooltip.nickname];
          return (
            <div
              style={{
                position: "fixed",
                top: tooltip.y + 12,
                left: tooltip.x + 12,
                background: "var(--color-bg)",
                color: "var(--color-text)",
                border: "var(--border-thin) solid var(--color-border-strong)",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-xs)",
                pointerEvents: "none",
                zIndex: 1000,
                maxWidth: "200px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                {card?.country && <Flag code={card.country} />}
                <strong>{tooltip.nickname}</strong>
                {card?.level != null && (
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    · {t("canvas.tooltip.levelShort")} {card.level}
                  </span>
                )}
              </div>
              {card?.title && (
                <div
                  style={{
                    marginTop: "2px",
                    color: card.title.data?.color ?? undefined,
                  }}
                >
                  {cosmeticName(card.title.key, card.title.name, t)}
                </div>
              )}
              {card?.badge && (
                <div
                  style={{
                    marginTop: "2px",
                    color: card.badge.data?.color ?? undefined,
                  }}
                >
                  {badgeIcon(card.badge.data?.icon)}{" "}
                  {cosmeticName(card.badge.key, card.badge.name, t)}
                </div>
              )}
              <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "2px" }}>
                {t("canvas.tooltip.ctrlClick")}
              </div>
            </div>
          );
        })()}

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
            <h2 style={{ marginTop: 0 }}>{t("canvas.publish.title")}</h2>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-secondary)",
              }}
            >
              {t("canvas.publish.area", {
                w: selection.x2 - selection.x1 + 1,
                h: selection.y2 - selection.y1 + 1,
              })}
            </p>
            <input
              type="text"
              placeholder={t("canvas.publish.titlePlaceholder")}
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
                {t("common.cancel")}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                style={{
                  padding: "8px 16px",
                  cursor: publishing ? "not-allowed" : "pointer",
                }}
              >
                {publishing
                  ? t("canvas.publish.publishing")
                  : t("canvas.publish.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && selection && (
        <ReportModal
          type="CANVAS"
          x1={selection.x1}
          y1={selection.y1}
          x2={selection.x2}
          y2={selection.y2}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Modal de compra de espacio privado */}
      {showPurchaseModal &&
        selection &&
        (() => {
          const claimActive = waitlist?.claimActive === true;
          const inQueueWaiting = waitlist?.inQueue === true && !claimActive;
          const selPixels =
            (selection.x2 - selection.x1 + 1) *
            (selection.y2 - selection.y1 + 1);
          const close = () => {
            setShowPurchaseModal(false);
            setPurchaseError("");
            setCapReached(false);
          };
          return (
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
                  border:
                    "var(--border-normal) solid var(--color-border-strong)",
                  maxWidth: "420px",
                  width: "90%",
                }}
              >
                <h2 style={{ marginTop: 0 }}>{t("canvas.purchase.title")}</h2>
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {t("canvas.purchase.area", {
                    w: selection.x2 - selection.x1 + 1,
                    h: selection.y2 - selection.y1 + 1,
                    px: selPixels,
                  })}
                </p>

                {inQueueWaiting ? (
                  <>
                    <p style={{ fontSize: "var(--text-sm)" }}>
                      {t("canvas.waitlist.inQueue", {
                        defaultValue: "Estás en la lista de espera.",
                      })}
                      {typeof waitlist?.position === "number" &&
                      waitlist.position > 0
                        ? " " +
                          t("canvas.waitlist.position", {
                            defaultValue: "Posición: {{n}}",
                            n: waitlist.position,
                          })
                        : ""}
                    </p>
                    <p
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {t("canvas.waitlist.waitInfo", {
                        defaultValue:
                          "Te avisaremos por correo cuando sea tu turno.",
                      })}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "flex-end",
                        marginTop: "12px",
                      }}
                    >
                      <button
                        onClick={close}
                        style={{ padding: "8px 16px", cursor: "pointer" }}
                      >
                        {t("common.close")}
                      </button>
                      <button
                        onClick={handleLeaveWaitlist}
                        style={{ padding: "8px 16px", cursor: "pointer" }}
                      >
                        {t("canvas.waitlist.leave", {
                          defaultValue: "Salir de la lista",
                        })}
                      </button>
                    </div>
                  </>
                ) : capReached ? (
                  <>
                    <p style={{ fontSize: "var(--text-sm)" }}>
                      {t("canvas.waitlist.full", {
                        defaultValue: "El espacio privado está al tope.",
                      })}{" "}
                      {t("canvas.waitlist.joinPrompt", {
                        defaultValue:
                          "Anótate en la lista de espera con esta área ({{px}} px).",
                        px: selPixels,
                      })}
                    </p>
                    {purchaseError && (
                      <p
                        style={{
                          color: "var(--color-danger)",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        {purchaseError}
                      </p>
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "flex-end",
                        marginTop: "12px",
                      }}
                    >
                      <button
                        onClick={close}
                        style={{ padding: "8px 16px", cursor: "pointer" }}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        onClick={handleJoinWaitlist}
                        disabled={joiningWaitlist}
                        style={{
                          padding: "8px 16px",
                          cursor: joiningWaitlist ? "not-allowed" : "pointer",
                        }}
                      >
                        {joiningWaitlist
                          ? t("canvas.waitlist.joining", {
                              defaultValue: "Anotando...",
                            })
                          : t("canvas.waitlist.join", {
                              defaultValue: "Anotarme",
                            })}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {claimActive && (
                      <div
                        style={{
                          background:
                            "color-mix(in srgb, var(--color-success) 14%, transparent)",
                          border:
                            "var(--border-thin) solid var(--color-success)",
                          borderRadius: "var(--radius-md)",
                          padding: "10px 12px",
                          marginBottom: "12px",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        <strong>
                          {t("canvas.waitlist.yourTurn", {
                            defaultValue: "¡Es tu turno!",
                          })}
                        </strong>{" "}
                        {waitlist?.claimExpiresAt &&
                          t("canvas.waitlist.claimUntil", {
                            defaultValue: "Compra antes del {{time}}.",
                            time: new Date(
                              waitlist.claimExpiresAt,
                            ).toLocaleString("es-MX"),
                          })}
                      </div>
                    )}

                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        marginBottom: "4px",
                      }}
                    >
                      {t("canvas.purchase.whoCanPaint")}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "12px",
                      }}
                    >
                      <button
                        onClick={() => setAccessMode("OWNER_ONLY")}
                        style={toggleButton(accessMode === "OWNER_ONLY")}
                      >
                        {t("canvas.purchase.ownerOnly")}
                      </button>
                      <button
                        onClick={() => setAccessMode("FRIENDS")}
                        style={toggleButton(accessMode === "FRIENDS")}
                      >
                        {t("canvas.purchase.friends")}
                      </button>
                      <button
                        onClick={() => setAccessMode("SPECIFIC")}
                        style={toggleButton(accessMode === "SPECIFIC")}
                      >
                        {t("canvas.purchase.specific")}
                      </button>
                    </div>

                    {accessMode === "SPECIFIC" && (
                      <input
                        type="text"
                        placeholder={t("canvas.purchase.membersPlaceholder")}
                        value={memberInput}
                        onChange={(e) => setMemberInput(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          marginBottom: "12px",
                          boxSizing: "border-box",
                        }}
                      />
                    )}

                    <div
                      style={{
                        fontSize: "var(--text-base)",
                        marginBottom: "12px",
                      }}
                    >
                      {quote ? (
                        <span>
                          {t("canvas.purchase.price")}{" "}
                          <strong style={{ color: "var(--color-brand)" }}>
                            {quote.monthlyBits} Bits
                          </strong>
                          {t("canvas.purchase.perMonth")}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-danger)" }}>
                          {quoteError || t("canvas.purchase.calculating")}
                        </span>
                      )}
                    </div>

                    {purchaseError && (
                      <p
                        style={{
                          color: "var(--color-danger)",
                          fontSize: "var(--text-sm)",
                          marginTop: 0,
                        }}
                      >
                        {purchaseError}
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
                        onClick={close}
                        style={{ padding: "8px 16px", cursor: "pointer" }}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        onClick={handlePurchase}
                        disabled={purchasing || !quote}
                        style={{
                          padding: "8px 16px",
                          cursor:
                            purchasing || !quote ? "not-allowed" : "pointer",
                        }}
                      >
                        {purchasing
                          ? t("canvas.purchase.purchasing")
                          : t("canvas.purchase.confirm")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

      {/* Aviso transitorio */}
      {notice && (
        <div
          style={{
            position: "absolute",
            top: "64px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--color-surface)",
            border: "var(--border-normal) solid var(--color-danger)",
            color: "var(--color-text)",
            padding: "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
            boxShadow: "var(--shadow-soft-md)",
            zIndex: 1500,
          }}
        >
          {notice}
        </div>
      )}

      {/* Modal de gestión de espacios privados */}
      {showManageModal && (
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
              maxWidth: "440px",
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--space-4)",
              }}
            >
              <h2 style={{ margin: 0 }}>{t("canvas.manage.title")}</h2>
              <button
                onClick={() => {
                  setShowManageModal(false);
                  setPrivateMode("buy");
                  // refrescar bordes por si liberó o cambió algo
                  fetch(API_URL + "/private-spaces/canvas")
                    .then((res) => res.json())
                    .then((data) => setPrivateSpaces(data))
                    .catch(() => {});
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-secondary)",
                  fontSize: "var(--text-xl)",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
                aria-label={t("common.close")}
              >
                ×
              </button>
            </div>
            <PrivateSpacesView
              onJumpToZone={(x1, y1, x2, y2) => {
                setShowManageModal(false);
                setPrivateMode("buy");
                jumpToZone(x1, y1, x2, y2);
              }}
            />
          </div>
        </div>
      )}

      <SideButtons
        activeSection={panelSection}
        onSelect={(s) => {
          if (soundEnabledRef.current) playNav();
          setPanelSection((prev) => (prev === s ? null : s));
        }}
        onReportBug={() => {
          if (soundEnabledRef.current) playNav();
          router.push("/report-bug");
        }}
        onOpenShop={() => {
          if (soundEnabledRef.current) playNav();
          openShop();
        }}
        panelOpen={panelSection !== null}
      />

      <SidePanel
        open={panelSection !== null}
        title={
          panelSection === "menu"
            ? t("panel.titles.menu")
            : panelSection === "settings"
              ? t("panel.titles.settings")
              : panelSection === "achievements"
                ? t("panel.titles.achievements")
                : panelSection === "tasks"
                  ? t("panel.titles.tasks")
                  : panelSection === "community"
                    ? t("panel.titles.community")
                    : panelSection === "bug"
                      ? t("panel.titles.bug")
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
        {panelSection === "achievements" && <AchievementsView />}
        {panelSection === "tasks" && <WeeklyTasksView />}
        {panelSection === "community" && <CommunityView isAdmin={isAdmin} />}
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

function toggleButton(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "6px 8px",
    fontSize: "var(--text-sm)",
    cursor: "pointer",
    borderRadius: "var(--radius-sm)",
    border: `var(--border-normal) solid ${
      active ? "var(--color-brand)" : "var(--color-border-strong)"
    }`,
    background: active ? "var(--color-elevated)" : "transparent",
    color: active ? "var(--color-brand)" : "var(--color-text)",
  };
}
