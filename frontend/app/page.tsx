"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./context/auth";
import { io } from "socket.io-client";

export default function Home() {
  const { token, nickname, logout } = useAuth();
  const tokenRef = useRef(token);

  const [clicksLeft, setClicksLeft] = useState(30);
  const [cooldown, setCooldown] = useState(0);
  const clicksRef = useRef(clicksLeft);
  const cooldownRef = useRef(cooldown);
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
      const rect = canvas.getBoundingClientRect();

      if (cooldownRef.current > 0) return;
      if (clicksRef.current <= 0) return;

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = Math.floor((event.clientX - rect.left) * scaleX);
      const y = Math.floor((event.clientY - rect.top) * scaleY);

      ctx.fillStyle = colorRef.current;
      ctx.fillRect(x, y, 1, 1);

      const key = `${x},${y}`;
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

      if (tokenRef.current) {
        headers["Authorization"] = `Bearer ${tokenRef.current}`;
      }

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
            if (data.state.isAdmin) {
              setClicksLeft(Infinity);
            } else if (data.state.pixelsLeft !== null) {
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
        const newZoom = Math.max(
          1,
          Math.min(event.deltaY < 0 ? prev + 1 : prev - 1, 40),
        );

        const canvasX = (container.scrollLeft + mouseX) / prev;
        const canvasY = (container.scrollTop + mouseY) / prev;

        requestAnimationFrame(() => {
          container.scrollLeft = canvasX * newZoom - mouseX;
          container.scrollTop = canvasY * newZoom - mouseY;
        });

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

    canvas.addEventListener("mousemove", handleMouseMove);

    // Y en el return del cleanup:
    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousemove", handleMouseMove);
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
      setClicksLeft(30);
      setCooldown(0);
      return;
    }

    const fetchUserState = async () => {
      const res = await fetch("http://localhost:3001/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.isAdmin) {
        setClicksLeft(Infinity);
        setCooldown(0);
        setUserTier("PREMIUM");
      } else {
        setClicksLeft(data.pixelsLeft ?? 20);
        setCooldown(data.cooldownSeconds ?? 0);
        setUserTier(data.subscriptionTier ?? "FREE");
      }
    };

    fetchUserState();
  }, [token]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

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
                if (data.isAdmin) {
                  setClicksLeft(Infinity);
                } else {
                  setClicksLeft(data.pixelsLeft ?? 20);
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

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "20px",
      }}
    >
      {/* Barra de usuario */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "10px",
        }}
      >
        {nickname ? (
          <>
            <span style={{ fontSize: "14px" }}>
              Hola, <strong>{nickname}</strong>
            </span>
            <button
              onClick={logout}
              style={{ fontSize: "13px", cursor: "pointer" }}
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <a href="/login" style={{ fontSize: "14px" }}>
              Iniciar sesión
            </a>
            <a href="/register" style={{ fontSize: "14px" }}>
              Registrarse
            </a>
          </>
        )}
      </div>

      <div style={{ marginBottom: "10px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 24px)",
            gap: "4px",
            justifyContent: "center",
          }}
        >
          {PALETTES[userTier].map((color) => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              style={{
                width: "24px",
                height: "24px",
                background: color,
                border:
                  selectedColor === color ? "2px solid #000" : "1px solid #888",
                cursor: "pointer",
                padding: 0,
              }}
              aria-label={color}
            />
          ))}
        </div>
        {userTier === "PREMIUM" && (
          <div style={{ marginTop: "8px", textAlign: "center" }}>
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
            />
          </div>
        )}
      </div>

      <div style={{ marginBottom: "10px", textAlign: "center" }}>
        <p>Píxeles restantes: {clicksLeft === Infinity ? "∞" : clicksLeft}</p>
        {cooldown > 0 && (
          <p style={{ color: "red" }}>
            En cooldown — espera {Math.floor(cooldown / 60)} min
          </p>
        )}
      </div>

      <div
        ref={containerRef}
        style={{
          overflow: "auto",
          maxHeight: "80vh",
          maxWidth: "80vw",
          border: "1px solid gray",
          cursor: "grab",
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
              border: "1px solid black",
              width: `${1000 * zoom}px`,
              height: `${1000 * zoom}px`,
              imageRendering: "pixelated",
              display: "block",
            }}
          />
          {zoom >= 3 && (
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
        </div>
      </div>
      {tooltip && (
        <div
          style={{
            position: "fixed",
            top: tooltip.y + 12,
            left: tooltip.x + 12,
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          {tooltip.nickname}
        </div>
      )}
    </main>
  );
}
