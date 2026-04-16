'use client';

import { useEffect, useRef } from 'react';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 1000;
    canvas.width = size;
    canvas.height = size;

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = Math.floor((event.clientX - rect.left) * scaleX);
      const y = Math.floor((event.clientY - rect.top) * scaleY);
      
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, 1, 1);
    });
  }, []);

  return (
    <main style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
      <canvas
        ref={canvasRef}
        style={{
          border: '1px solid black',
          width: '500px',
          height: '500px',
          imageRendering: 'pixelated',
        }}
      />
    </main>
  );
}
