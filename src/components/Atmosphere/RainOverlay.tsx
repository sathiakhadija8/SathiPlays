'use client';

import { useEffect, useRef } from 'react';

type Drop = {
  x: number;
  y: number;
  length: number;
  speed: number;
  width: number;
  alpha: number;
  sway: number;
  swaySpeed: number;
};

function createDrops(width: number, height: number, count: number): Drop[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    length: 14 + Math.random() * 22,
    speed: 8 + Math.random() * 11,
    width: 0.7 + Math.random() * 1.1,
    alpha: 0.12 + Math.random() * 0.16,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.02 + Math.random() * 0.03,
  }));
}

export function RainOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let width = 0;
    let height = 0;
    let drops: Drop[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const density = width < 900 ? 0.00016 : 0.00022;
      const count = Math.max(52, Math.floor(width * height * density));
      drops = createDrops(width, height, count);
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = (timestamp: number) => {
      if (timestamp - lastFrameRef.current < 33) {
        rafRef.current = window.requestAnimationFrame(animate);
        return;
      }
      lastFrameRef.current = timestamp;

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round';
      ctx.shadowBlur = 2;
      ctx.shadowColor = 'rgba(185, 216, 242, 0.18)';

      for (const drop of drops) {
        drop.sway += drop.swaySpeed;
        drop.x += Math.sin(drop.sway) * 0.18; // subtle natural flutter
        drop.y += drop.speed;

        if (drop.y > height + 30) {
          drop.x = Math.random() * width;
          drop.y = -20 - Math.random() * 160;
        }

        const endX = drop.x;
        const endY = drop.y - drop.length;

        const gradient = ctx.createLinearGradient(drop.x, drop.y, endX, endY);
        gradient.addColorStop(0, `rgba(204, 230, 248, ${drop.alpha})`);
        gradient.addColorStop(1, 'rgba(204, 230, 248, 0)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = drop.width;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }

      rafRef.current = window.requestAnimationFrame(animate);
    };

    rafRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[11]"
      aria-hidden
    />
  );
}
