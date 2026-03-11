import type { ComponentPropsWithoutRef, PropsWithChildren } from 'react';

type GlassCardProps = PropsWithChildren<{
  className?: string;
  depth?: 'secondary' | 'main';
}> &
  ComponentPropsWithoutRef<'section'>;

export function GlassCard({ children, className = '', depth = 'secondary', ...rest }: GlassCardProps) {
  const depthClass = depth === 'main' ? 'glass-depth-main' : 'glass-depth-secondary';

  return (
    <section
      {...rest}
      className={`rounded-3xl border border-[rgba(255,255,255,0.12)] shadow-[0_10px_28px_rgba(8,5,32,0.42)] glass-depth-hover ${depthClass} transition-all duration-300 hover:-translate-y-[2px] hover:border-[rgba(255,255,255,0.18)] hover:shadow-[0_0_20px_rgba(255,255,255,0.18),0_12px_34px_rgba(255,62,165,0.15)] ${className}`}
    >
      {children}
    </section>
  );
}
