import type { CSSProperties } from 'react';
import type { GlowRoutine } from '../../lib/glow-types';

export function RoutineCard({
  routine,
  onStart,
  actionLabel = 'Start',
  statusText,
  style,
}: {
  routine: GlowRoutine;
  onStart: () => void;
  actionLabel?: string;
  statusText?: string;
  style?: CSSProperties;
}) {
  return (
    <div style={style} className="routine-float animate-routine-white-pulse group relative flex h-40 w-40 max-[900px]:h-32 max-[900px]:w-32 flex-col items-center justify-center rounded-full border border-white/10 bg-[rgba(18,16,40,0.46)] p-3.5 max-[900px]:p-2.5 text-center shadow-[0_0_24px_rgba(255,62,165,0.14)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_0_30px_rgba(255,62,165,0.28)]">
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_52%),radial-gradient(circle_at_70%_80%,rgba(192,132,252,0.16),transparent_56%)] opacity-90" />
      <h3 className="relative font-serif text-lg max-[900px]:text-base text-[#F8F4FF]">{routine.name}</h3>
      <p className="relative mt-1 font-sans text-[11px] text-[#B9B4D9]">{routine.type} • {routine.current_streak}d</p>
      {statusText ? <p className="relative mt-1 font-sans text-[10px] text-[#F8F4FF]">{statusText}</p> : null}
      <button
        type="button"
        onClick={onStart}
        className="relative mt-2.5 max-[900px]:mt-2 rounded-full border border-[#FF3EA580] bg-[#FF3EA530] px-3.5 max-[900px]:px-3 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-200 group-hover:shadow-[0_0_14px_rgba(255,62,165,0.26)]"
      >
        {actionLabel}
      </button>
    </div>
  );
}
