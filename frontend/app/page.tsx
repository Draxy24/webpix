"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState("#000000");
  const colorRef = useRef(selectedColor);
  const [pixels, setPixels] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};

    const saved = localStorage.getItem("pixels");
    return saved ? JSON.parse(saved) : {};
  });
  const [zoom, setZoom] = useState(10);

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

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = Math.floor((event.clientX - rect.left) * scaleX);
      const y = Math.floor((event.clientY - rect.top) * scaleY);

      ctx.fillStyle = colorRef.current;
      ctx.fillRect(x, y, 1, 1);

      const key = `${x},${y}`;
      setPixels((prev) => ({ ...prev, [key]: colorRef.current }));

      fetch("http://localhost:3001/pixel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          x,
          y,
          color: colorRef.current,
        }),
      });
    };

    canvas.addEventListener("click", handleClick);

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      setZoom((prev) => {
        const newZoom = event.deltaY < 0 ? prev + 1 : prev - 1;
        return Math.max(1, Math.min(newZoom, 15));
      });
    };

    canvas.addEventListener("wheel", handleWheel);

    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("wheel", handleWheel);
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

    if (zoom >= 5) {
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1 / zoom;

      const step = zoom >= 20 ? 1 : zoom >= 10 ? 5 : 10;

      for (let x = 0; x <= canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y <= canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(canvas.width, y + 0.5);
        ctx.stroke();
      }
    }
  }, [pixels, zoom]);

  useEffect(() => {
    localStorage.setItem("pixels", JSON.stringify(pixels));
  }, [pixels]);

  useEffect(() => {
    const loadPixels = async () => {
      const res = await fetch("http://localhost:3001/pixels");
      const data = await res.json();
      setPixels(data);
    };

    loadPixels();
  }, []);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "20px",
      }}
    >
      <input
        type="color"
        value={selectedColor}
        onChange={(e) => setSelectedColor(e.target.value)}
        style={{ marginBottom: "10px" }}
      />

      <div
        style={{
          overflow: "auto",
          maxHeight: "80vh",
          maxWidth: "80vw",
          border: "1px solid gray",
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
      </div>
    </main>
  );
}
