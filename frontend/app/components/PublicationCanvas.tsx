"use client";

import { useEffect, useRef } from "react";

interface PublicationCanvasProps {
  pixelData: Record<string, string>;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  maxSize: number;
}

export default function PublicationCanvas({ pixelData, x1, y1, x2, y2, maxSize }: PublicationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = x2 - x1 + 1;
  const height = y2 - y1 + 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    for (const key in pixelData) {
      const [x, y] = key.split(",").map(Number);
      ctx.fillStyle = pixelData[key];
      ctx.fillRect(x - x1, y - y1, 1, 1);
    }
  }, [pixelData, x1, y1, width, height]);

  const aspectRatio = width / height;
  const displayWidth = aspectRatio >= 1 ? maxSize : maxSize * aspectRatio;
  const displayHeight = aspectRatio >= 1 ? maxSize / aspectRatio : maxSize;

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        imageRendering: "pixelated",
        border: "1px solid #555",
        background: "#fff",
        display: "block",
      }}
    />
  );
}
