'use client';

import type { CSSProperties, MouseEvent } from 'react';
import { useState } from 'react';
import Link from 'next/link';

interface PortalButtonProps {
  label: string;
  icon: string;
  iconImageSrc?: string;
  accentBorder: string;
  glowColor: string;
  href: string;
  delayMs?: number;
  floatDurationSec?: number;
}

export function PortalButton({
  label,
  icon,
  iconImageSrc,
  accentBorder,
  glowColor,
  href,
  delayMs = 0,
  floatDurationSec = 7.2,
}: PortalButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [cursorPoint, setCursorPoint] = useState({ x: 72, y: 72 });

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCursorPoint({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  return (
    <Link
      href={href}
      prefetch
      data-cursor-hover
      className="group flex flex-col items-center gap-3 text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[2px] max-[520px]:gap-2"
      aria-label={label}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={onMouseMove}
        className="portal-float-glow relative grid h-[clamp(6.15rem,9.4vw,8.75rem)] w-[clamp(6.15rem,9.4vw,8.75rem)] place-items-center overflow-hidden rounded-full bg-[rgba(18,16,40,0.5)] backdrop-blur-lg shadow-[0_10px_20px_rgba(8,5,26,0.5)] transition-all duration-200 group-hover:shadow-[0_14px_28px_rgba(8,5,26,0.55),0_0_30px_var(--glow-strong)] max-[520px]:h-[88px] max-[520px]:w-[88px]"
        style={
          {
            boxShadow: `0 10px 20px rgba(8,5,26,0.5), 0 0 10px ${glowColor}28`,
            '--glow-strong': `${glowColor}66`,
            '--float-duration': `${floatDurationSec}s`,
            '--ring-duration': `${(floatDurationSec * 2.2).toFixed(2)}s`,
            animationDelay: `${delayMs}ms`,
          } as CSSProperties
        }
      >
        <div className="portal-ring-shimmer absolute inset-0 rounded-full p-[1.5px]" style={{ background: accentBorder }}>
          <div className="h-full w-full rounded-full bg-[rgba(18,16,40,0.70)]" />
        </div>

        <div
          className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-200"
          style={{
            opacity: hovered ? 1 : 0,
            background: `radial-gradient(circle at ${cursorPoint.x}px ${cursorPoint.y}px, ${glowColor}38, transparent 58%)`,
          }}
        />

        {iconImageSrc ? (
          <img
            src={iconImageSrc}
            alt={`${label} icon`}
            className="relative z-[1] h-[96px] w-[96px] object-contain drop-shadow-[0_0_18px_rgba(255,255,255,0.62)] transition-transform duration-200 group-hover:scale-[1.06] max-[900px]:h-[80px] max-[900px]:w-[80px] max-[520px]:h-[66px] max-[520px]:w-[66px]"
          />
        ) : (
          <span className="relative z-[1] text-2xl text-[#F8F4FF]/85 transition-transform duration-200 group-hover:scale-[1.06]">{icon}</span>
        )}
      </div>
      <span className="font-sans text-sm tracking-wide text-[#F8F4FF] max-[520px]:text-xs">{label}</span>
    </Link>
  );
}
