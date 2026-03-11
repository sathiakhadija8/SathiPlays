'use client';

import { useEffect, useRef } from 'react';

type Star = {
  x: number;
  y: number;
  r: number;
  alphaBase: number;
  twinkleSpeed: number;
  phase: number;
  dx: number;
  dy: number;
  intensity: number;
};

function createStars(width: number, height: number, count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * (height * 0.96),
    r: 0.55 + Math.random() * 1.7,
    alphaBase: 0.18 + Math.random() * 0.22,
    twinkleSpeed: 0.009 + Math.random() * 0.018,
    phase: Math.random() * Math.PI * 2,
    dx: (Math.random() - 0.5) * 0.02,
    dy: (Math.random() - 0.5) * 0.02,
    intensity: 0.7 + Math.random() * 0.7,
  }));
}

export function StarsOverlay() {
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
    let stars: Star[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const density = width < 900 ? 0.00024 : 0.00034;
      const count = Math.max(160, Math.floor(width * height * density));
      stars = createStars(width, height, count);
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

      for (const star of stars) {
        star.phase += star.twinkleSpeed;
        star.x += star.dx;
        star.y += star.dy;

        if (star.x < -5) star.x = width + 5;
        if (star.x > width + 5) star.x = -5;
        if (star.y < -5) star.y = height + 5;
        if (star.y > height + 5) star.y = -5;

        const twinkle = 0.32 + 0.68 * (0.5 + 0.5 * Math.sin(star.phase));
        const alpha = star.alphaBase * twinkle * star.intensity;

        // Core star
        ctx.fillStyle = `rgba(244, 248, 255, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();

        // Micro halo for depth on brighter stars
        if (star.intensity > 1.1) {
          ctx.fillStyle = `rgba(220, 236, 255, ${(alpha * 0.38).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r * 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Tiny background starfield layer for extra depth
      const tinyCount = Math.max(60, Math.floor(stars.length * 0.36));
      for (let i = 0; i < tinyCount; i += 1) {
        const s = stars[i];
        const tinyAlpha = (0.06 + 0.08 * (0.5 + 0.5 * Math.sin(s.phase * 0.8 + i))).toFixed(3);
        ctx.fillStyle = `rgba(210, 228, 248, ${tinyAlpha})`;
        ctx.fillRect((s.x * 1.07) % width, (s.y * 1.05) % height, 1, 1);
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
      className="pointer-events-none fixed inset-0 z-[10]"
      aria-hidden
    />
  );
}
