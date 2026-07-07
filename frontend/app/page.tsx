"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { useAuth } from "./context/auth";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";
import FloatingToolbox, {
  type Tool,
  type EraseMode,
  type PrivateMode,
} from "./components/FloatingToolbox";
import SideButtons, { type PanelSection } from "./components/SideButtons";
import { useSettings } from "./context/settings";
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
import { useTranslation } from "react-i18next";
import {
  eventToast,
  handleSocketNotification,
  type SocketNotification,
} from "./lib/rewardToast";
import { TFunction } from "i18next";
const SidePanel = dynamic(() => import("./components/SidePanel"), {
  ssr: false,
});
const MenuPanel = dynamic(() => import("./components/MenuPanel"), {
  ssr: false,
});
const SettingsPanel = dynamic(() => import("./components/SettingsPanel"), {
  ssr: false,
});
const BugReportView = dynamic(() => import("./components/BugReportView"), {
  ssr: false,
});
const PrivateSpacesView = dynamic(
  () => import("./components/PrivateSpacesView"),
  { ssr: false },
);
const AchievementsView = dynamic(
  () => import("./components/AchievementsView"),
  { ssr: false },
);
const WeeklyTasksView = dynamic(() => import("./components/WeeklyTasksView"), {
  ssr: false,
});
const CommunityView = dynamic(() => import("./components/CommunityView"), {
  ssr: false,
});
const ReportModal = dynamic(() => import("./components/ReportModal"), {
  ssr: false,
});
const WelcomeModal = dynamic(() => import("./components/WelcomeModal"), {
  ssr: false,
});

function formatPeriod(period: string, lang: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Formatea segundos de cooldown a un texto compacto: "2h 30m", "45m 12s", "32s".
// Los segundos solo se muestran si el cooldown es menor a 1 hora (evita ruido
// en cooldowns largos donde ver los segundos correr no aporta).
function formatCooldown(totalSeconds: number, t: TFunction): string {
  if (totalSeconds <= 0) return "";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h > 0)
    parts.push(`${h}${t("canvas.cooldownUnits.h", { defaultValue: "h" })}`);
  if (m > 0)
    parts.push(`${m}${t("canvas.cooldownUnits.m", { defaultValue: "m" })}`);
  if (s > 0 && h === 0)
    parts.push(`${s}${t("canvas.cooldownUnits.s", { defaultValue: "s" })}`);
  return parts.join(" ");
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ pointerEvents: "none" }}
    >
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

  const [clicksLeft, setClicksLeft] = useState(60);
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
  const [showWelcome, setShowWelcome] = useState(false);
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

  const multiTouchRef = useRef(false);
  const [gestureLock, setGestureLock] = useState(false);
  const gestureLockRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Fuente de verdad de la cámara. transform-origin del wrapper = 0,0, así que
  // un punto del lienzo (cx,cy) cae en pantalla en (tx + cx*scale, ty + cy*scale).
  const viewRef = useRef({ scale: 10, tx: 0, ty: 0 });
  const selectionModeRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeToolRef = useRef(activeTool);
  // Fuente de verdad de los píxeles (mutable, sin pasar por React).
  // key "x,y" → color. Se muta directo; NO se clona.
  const pixelsMapRef = useRef<Map<string, string>>(new Map());
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

      const prevColor = pixelsMapRef.current.get(key);
      if (!prevColor) return; // nada que borrar localmente

      // Optimista: quita el píxel del Map + pinta blanco, y quita su dueño.
      clearCellsRef.current([{ x, y }]);
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
            drawCellsRef.current([{ x, y }], prevColor);
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
          drawCellsRef.current([{ x, y }], prevColor);
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
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleSelectionMouseDown);
      canvas.removeEventListener("mouseup", handleSelectionMouseUp);
    };
  }, []);

  // Redibuja TODO el canvas desde el Map. Solo se llama cuando de verdad hace
  // falta: carga inicial, o cambios masivos del WebSocket. NUNCA por pincelada.
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [key, color] of pixelsMapRef.current) {
      const [x, y] = key.split(",").map(Number);
      ctx.fillStyle = resolveColor(color, x, y);
      ctx.fillRect(x, y, 1, 1);
    }
  }, []);
  const redrawAllRef = useRef(redrawAll);
  useEffect(() => {
    redrawAllRef.current = redrawAll;
  }, [redrawAll]);

  useEffect(() => {
    redrawAll();
    if (highlightZone) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      const { x1, y1, x2, y2 } = highlightZone;
      const w = x2 - x1 + 1;
      const h = y2 - y1 + 1;
      ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
      ctx.fillRect(x1, y1, w, h);
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 1;
      ctx.strokeRect(x1 + 0.5, y1 + 0.5, w - 1, h - 1);
    }
  }, [redrawAll, highlightZone]);

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
    let buffer: { x: number; y: number }[] = []; // pendientes de mandar al server
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
        accepted.push(c);
        // Muta el Map + dibuja, sin pasar por React.
        pixelsMapRef.current.set(key, dragColor);
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
    };

    // Cola de envíos serializada: nunca dos batches en vuelo a la vez.
    let sendQueue: { x: number; y: number }[][] = [];
    let sending = false;

    const processQueue = async () => {
      if (sending) return;
      sending = true;
      while (sendQueue.length > 0) {
        const cells = sendQueue.shift()!;
        await sendChunkAwait(cells); // espera a que termine antes del siguiente
      }
      sending = false;
    };

    let serverSkippedByQuota = 0; // celdas que el server no pintó por límite

    // Versión de sendChunk que devuelve una promesa (para poder esperarla).
    const sendChunkAwait = async (cells: { x: number; y: number }[]) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (tokenRef.current)
        headers["Authorization"] = `Bearer ${tokenRef.current}`;
      try {
        const res = await fetch(API_URL + "/pixel-batch", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ color: dragColor, cells }),
        });
        const data = await res.json();
        if (!data.success) {
          clearCellsRef.current(cells);
          if (data.cooldownSeconds > 0) setCooldown(data.cooldownSeconds);
          else if (data.message || data.code)
            setNotice(apiErrorText(data, tRef.current));
          return;
        }
        if (Array.isArray(data.skipped) && data.skipped.length > 0) {
          clearCellsRef.current(data.skipped);
          serverSkippedByQuota += data.skipped.length;
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
      } catch {
        clearCellsRef.current(cells);
      }
    };

    const flush = (isFinal = false) => {
      if (buffer.length === 0) return;
      do {
        sendQueue.push(buffer.splice(0, MAX_PER_REQUEST));
      } while (isFinal && buffer.length > 0);
      void processQueue(); // arranca el worker si no está corriendo
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
      serverSkippedByQuota = 0;
      buffer = [];

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
      // Cuando la cola termine, evaluamos el veredicto del servidor.
      void processQueue().then(() => {
        if (serverSkippedByQuota > 0) {
          setNotice(
            tRef.current("canvas.drag.paintedXofY", {
              defaultValue: "Pinté {{x}} de {{y}} píxeles (límite alcanzado).",
              x: triedThisDrag.size - serverSkippedByQuota,
              y: triedThisDrag.size,
            }),
          );
        }
      });
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
    const loadPixels = async () => {
      const res = await fetch(API_URL + "/pixels");
      const data = await res.json();
      // Llena el Map (fuente de verdad) y redibuja una vez.
      const map = new Map<string, string>();
      for (const key in data.colors) map.set(key, data.colors[key]);
      pixelsMapRef.current = map;
      redrawAllRef.current();
      setPixelOwners(data.owners);
    };
    loadPixels();
  }, []);

  useEffect(() => {
    if (!token) {
      setUserTier("FREE");
      setIsAdmin(false);

      fetch(API_URL + "/anonymous-state", {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data: { pixelsLeft: number; cooldownSeconds: number }) => {
          setClicksLeft(data.pixelsLeft);
          setCooldown(data.cooldownSeconds);
        })
        .catch((error) =>
          console.error("Failed to fetch anonymous state:", error),
        );

      try {
        if (!localStorage.getItem("webpix_seen_welcome")) setShowWelcome(true);
      } catch {}
      return;
    }

    const fetchUserState = async () => {
      const res = await fetch(API_URL + "/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Token vencido o inválido: el server responde 401. NO es falta de verificación.
      if (!res.ok) {
        if (res.status === 401) logout(); // limpia el token muerto → queda como anónimo
        return; // nunca mandes a /verify por una respuesta fallida
      }

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
      if (!data.hasSeenWelcome) setShowWelcome(true);
    };

    fetchUserState();
  }, [token]);

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
            setClicksLeft(60);
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
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        for (const p of data.pixels) {
          pixelsMapRef.current.set(`${p.x},${p.y}`, p.color);
          if (ctx) {
            ctx.fillStyle = resolveColor(p.color, p.x, p.y);
            ctx.fillRect(p.x, p.y, 1, 1);
          }
        }
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
      clearCellsRef.current(data.cells);
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
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    let lastSoundAt = 0;
    const FLUSH_MS = 120;
    const MAX_PER_REQUEST = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
        accepted.push(c);
        // Muta el Map + dibuja, sin pasar por React.
        pixelsMapRef.current.set(key, dragColor);
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
    };

    // Cola de envíos serializada: nunca dos batches en vuelo a la vez.
    let sendQueue: { x: number; y: number }[][] = [];
    let sending = false;

    const processQueue = async () => {
      if (sending) return;
      sending = true;
      while (sendQueue.length > 0) {
        const cells = sendQueue.shift()!;
        await sendChunkAwait(cells); // espera a que termine antes del siguiente
      }
      sending = false;
    };

    let serverSkippedByQuota = 0; // celdas que el server no pintó por límite

    // Versión de sendChunk que devuelve una promesa (para poder esperarla).
    const sendChunkAwait = async (cells: { x: number; y: number }[]) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (tokenRef.current)
        headers["Authorization"] = `Bearer ${tokenRef.current}`;
      try {
        const res = await fetch(API_URL + "/pixel-batch", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ color: dragColor, cells }),
        });
        const data = await res.json();
        if (!data.success) {
          clearCellsRef.current(cells);
          if (data.cooldownSeconds > 0) setCooldown(data.cooldownSeconds);
          else if (data.message || data.code)
            setNotice(apiErrorText(data, tRef.current));
          return;
        }
        if (Array.isArray(data.skipped) && data.skipped.length > 0) {
          clearCellsRef.current(data.skipped);
          serverSkippedByQuota += data.skipped.length;
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
      } catch {
        clearCellsRef.current(cells);
      }
    };

    const flush = (isFinal = false) => {
      if (buffer.length === 0) return;
      do {
        sendQueue.push(buffer.splice(0, MAX_PER_REQUEST));
      } while (isFinal && buffer.length > 0);
      void processQueue(); // arranca el worker si no está corriendo
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
        serverSkippedByQuota = 0;
        buffer = [];
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
        // Esperamos a que la cola termine para saber el veredicto final del server.
        void processQueue().then(() => {
          if (serverSkippedByQuota > 0) {
            setNotice(
              tRef.current("canvas.drag.paintedXofY", {
                defaultValue:
                  "Pinté {{x}} de {{y}} píxeles (límite alcanzado).",
                x: triedThisDrag.size - serverSkippedByQuota,
                y: triedThisDrag.size,
              }),
            );
          }
        });
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

  const jumpToZone = useCallback(
    (rx1: number, ry1: number, rx2: number, ry2: number) => {
      const x1 = Math.max(0, Math.min(rx1, rx2));
      const y1 = Math.max(0, Math.min(ry1, ry2));
      const x2 = Math.min(999, Math.max(rx1, rx2));
      const y2 = Math.min(999, Math.max(ry1, ry2));
      const fit = clampScale(
        Math.min(
          (window.innerWidth * 0.6) / (x2 - x1 + 1),
          (window.innerHeight * 0.6) / (y2 - y1 + 1),
        ),
      );
      const cx = (x1 + x2 + 1) / 2,
        cy = (y1 + y2 + 1) / 2;
      setViewRef.current(
        fit,
        window.innerWidth / 2 - cx * fit,
        window.innerHeight / 2 - cy * fit,
      );
      setHighlightZone({ x1, y1, x2, y2 });
      setTimeout(() => setHighlightZone(null), 4000);
    },
    [],
  );

  const MAX_SCALE = 40;
  const minScale = () => Math.max(window.innerWidth, window.innerHeight) / 1000; // el lienzo siempre cubre
  const clampScale = (s: number) =>
    Math.max(minScale(), Math.min(s, MAX_SCALE));

  // Evita que el lienzo se "pierda": lo ancla a las orillas, o lo centra si cabe.
  const clampOffset = (scale: number, tx: number, ty: number) => {
    const fit = (t: number, scaled: number, view: number) =>
      scaled <= view
        ? (view - scaled) / 2
        : Math.max(view - scaled, Math.min(t, 0));
    return {
      tx: fit(tx, 1000 * scale, window.innerWidth),
      ty: fit(ty, 1000 * scale, window.innerHeight),
    };
  };

  // Dibuja y registra un conjunto de celdas de un color. Muta el Map + pinta.
  const drawCells = useCallback(
    (cells: { x: number; y: number }[], color: string) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      for (const c of cells) {
        if (c.x < 0 || c.x > 999 || c.y < 0 || c.y > 999) continue;
        pixelsMapRef.current.set(`${c.x},${c.y}`, color);
        ctx.fillStyle = resolveColor(color, c.x, c.y);
        ctx.fillRect(c.x, c.y, 1, 1);
      }
    },
    [],
  );
  const drawCellsRef = useRef(drawCells);
  useEffect(() => {
    drawCellsRef.current = drawCells;
  }, [drawCells]);

  // Borra un conjunto de celdas: las quita del Map y pinta blanco encima.
  const clearCells = useCallback((cells: { x: number; y: number }[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    for (const c of cells) {
      pixelsMapRef.current.delete(`${c.x},${c.y}`);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(c.x, c.y, 1, 1);
    }
  }, []);
  const clearCellsRef = useRef(clearCells);
  useEffect(() => {
    clearCellsRef.current = clearCells;
  }, [clearCells]);

  // Aplica la cámara YA, imperativamente (sin ciclo de React = sin teletransporte).
  const applyView = useCallback(() => {
    const { scale, tx, ty } = viewRef.current;
    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      wrapper.style.setProperty("--scale", String(scale));
    }
    const grid = gridRef.current;
    if (grid) {
      if (scale >= settings.gridThreshold) {
        grid.style.display = "block";
        grid.style.backgroundSize = `${scale}px ${scale}px`;
        grid.style.backgroundPositionX = `${tx % scale}px`;
        grid.style.backgroundPositionY = `${ty % scale}px`;
      } else {
        grid.style.display = "none";
      }
    }
  }, [settings.gridThreshold]);
  const applyViewRef = useRef(applyView);
  useEffect(() => {
    applyViewRef.current = applyView;
  }, [applyView]);

  const setView = useCallback((scale: number, tx: number, ty: number) => {
    const s = clampScale(scale);
    const off = clampOffset(s, tx, ty);
    viewRef.current = { scale: s, tx: off.tx, ty: off.ty };
    applyViewRef.current();
  }, []);
  const setViewRef = useRef(setView);
  useEffect(() => {
    setViewRef.current = setView;
  }, [setView]);

  // Cambia la escala clavando un punto de pantalla (cursor o centro del pinch).
  const zoomAt = useCallback(
    (nextScale: number, screenX: number, screenY: number) => {
      const { scale, tx, ty } = viewRef.current;
      const s = clampScale(nextScale);
      if (s === scale) return;
      const cx = (screenX - tx) / scale; // punto del lienzo bajo el ancla
      const cy = (screenY - ty) / scale;
      setViewRef.current(s, screenX - cx * s, screenY - cy * s);
    },
    [],
  );

  const closeWelcome = useCallback(() => {
    setShowWelcome(false);
    if (tokenRef.current) {
      fetch(API_URL + "/auth/welcome-seen", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      }).catch(() => {});
    } else {
      try {
        localStorage.setItem("webpix_seen_welcome", "1");
      } catch {}
    }
  }, []);

  const zoomAtRef = useRef(zoomAt);
  useEffect(() => {
    zoomAtRef.current = zoomAt;
  }, [zoomAt]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cur = viewRef.current.scale;
      const next =
        e.deltaY < 0 ? Math.floor(cur + 1e-3) + 1 : Math.ceil(cur - 1e-3) - 1;
      zoomAtRef.current(next, e.clientX - rect.left, e.clientY - rect.top);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let dragging = false;
    let sx = 0,
      sy = 0,
      stx = 0,
      sty = 0;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      dragging = true;
      container.style.cursor = "grabbing";
      sx = e.clientX;
      sy = e.clientY;
      stx = viewRef.current.tx;
      sty = viewRef.current.ty;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      setViewRef.current(
        viewRef.current.scale,
        stx + (e.clientX - sx),
        sty + (e.clientY - sy),
      );
    };
    const onUp = () => {
      dragging = false;
      container.style.cursor = "grab";
    };
    const noMenu = (e: MouseEvent) => e.preventDefault();
    container.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    container.addEventListener("contextmenu", noMenu);
    return () => {
      container.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      container.removeEventListener("contextmenu", noMenu);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let panning = false;
    let sx = 0,
      sy = 0,
      stx = 0,
      sty = 0;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        panning = false;
        return;
      }
      if (gestureLockRef.current) return; // con lock el dedo pinta/selecciona
      panning = true;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      stx = viewRef.current.tx;
      sty = viewRef.current.ty;
    };
    const onMove = (e: TouchEvent) => {
      if (!panning) return;
      if (e.touches.length !== 1) {
        panning = false;
        return;
      }
      setViewRef.current(
        viewRef.current.scale,
        stx + (e.touches[0].clientX - sx),
        sty + (e.touches[0].clientY - sy),
      );
      e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) panning = false;
    };
    container.addEventListener("touchstart", onStart, { passive: false });
    container.addEventListener("touchmove", onMove, { passive: false });
    container.addEventListener("touchend", onEnd);
    container.addEventListener("touchcancel", onEnd);
    return () => {
      container.removeEventListener("touchstart", onStart);
      container.removeEventListener("touchmove", onMove);
      container.removeEventListener("touchend", onEnd);
      container.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let startDist = 0,
      startScale = 0,
      midX = 0,
      midY = 0;
    let snapRAF: number | null = null;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        multiTouchRef.current = true;
        if (snapRAF) {
          cancelAnimationFrame(snapRAF);
          snapRAF = null;
        }
        startDist = dist(e.touches);
        startScale = viewRef.current.scale;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      e.preventDefault();
      const d = dist(e.touches);
      if (startDist === 0) {
        startDist = d;
        return;
      }
      const rect = container.getBoundingClientRect();
      midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      zoomAtRef.current(startScale * (d / startDist), midX, midY);
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length !== 0) return;
      startDist = 0;
      const from = viewRef.current.scale;
      const to = clampScale(Math.round(from));
      const ax = midX,
        ay = midY;
      if (Math.abs(to - from) > 0.001) {
        const t0 = performance.now(),
          dur = 130;
        const ease = (p: number) => 1 - Math.pow(1 - p, 3);
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / dur);
          zoomAtRef.current(from + (to - from) * ease(p), ax, ay);
          snapRAF = p < 1 ? requestAnimationFrame(step) : null;
        };
        snapRAF = requestAnimationFrame(step);
      }
      setTimeout(() => {
        multiTouchRef.current = false;
      }, 350);
    };
    container.addEventListener("touchstart", onStart, { passive: false });
    container.addEventListener("touchmove", onMove, { passive: false });
    container.addEventListener("touchend", onEnd);
    container.addEventListener("touchcancel", onEnd);
    return () => {
      container.removeEventListener("touchstart", onStart);
      container.removeEventListener("touchmove", onMove);
      container.removeEventListener("touchend", onEnd);
      container.removeEventListener("touchcancel", onEnd);
      if (snapRAF) cancelAnimationFrame(snapRAF);
    };
  }, []);

  // Arranque + re-clampeo al cambiar el tamaño de la ventana.
  useEffect(() => {
    const s = clampScale(10);
    setViewRef.current(
      s,
      (window.innerWidth - 1000 * s) / 2,
      (window.innerHeight - 1000 * s) / 2,
    );
    const onResize = () => {
      const v = viewRef.current;
      setViewRef.current(v.scale, v.tx, v.ty);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
          overflow: "hidden", // ya no scrolleamos: movemos con transform
          cursor: "grab",
          touchAction: "none",
          overscrollBehavior: "contain",
        }}
      >
        <div
          ref={wrapperRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1000px",
            height: "1000px",
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: "1000px",
              height: "1000px",
              imageRendering: "pixelated",
              display: "block",
              background: "#fff",
            }}
          />
          {selection && (
            <div
              style={{
                position: "absolute",
                left: `${selection.x1}px`,
                top: `${selection.y1}px`,
                width: `${selection.x2 - selection.x1 + 1}px`,
                height: `${selection.y2 - selection.y1 + 1}px`,
                border: "calc(2px / var(--scale, 10)) solid var(--color-brand)",
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
                left: `${sp.x1}px`,
                top: `${sp.y1}px`,
                width: `${sp.x2 - sp.x1 + 1}px`,
                height: `${sp.y2 - sp.y1 + 1}px`,
                border: "calc(2px / var(--scale, 10)) dashed #8B5CF6",
                background: "rgba(139, 92, 246, 0.08)",
                pointerEvents: "none",
                boxSizing: "border-box",
                zIndex: 5,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: "100%",
                  transformOrigin: "left bottom",
                  scale: "calc(1 / var(--scale, 10))", // contra-escala: no crece con el zoom
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

        {/* Rejilla en espacio de pantalla: líneas siempre de 1px, las pinta applyView() */}
        <div
          ref={gridRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            display: "none",
            backgroundImage: `
        linear-gradient(to right, rgba(0,0,0,0.15) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0,0,0,0.15) 1px, transparent 1px)
      `,
          }}
        />
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
            {t("canvas.cooldown")} {formatCooldown(cooldown, t)}
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
          aria-label={
            gestureLock
              ? t("canvas.lock.unlock", {
                  defaultValue: "Desbloquear pantalla",
                })
              : t("canvas.lock.lock", { defaultValue: "Bloquear pantalla" })
          }
          style={{
            position: "fixed",
            bottom: "80px",
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

      {showWelcome && (
        <WelcomeModal
          isLoggedIn={!!token}
          onClose={closeWelcome}
          onRegister={() => router.push("/register")}
        />
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
