import type { ComponentPropsWithoutRef, PropsWithChildren } from 'react';

type Props = PropsWithChildren<{ className?: string }> & ComponentPropsWithoutRef<'section'>;

export function CareerGlassCard({ children, className = '', ...rest }: Props) {
  return (
    <section
      {...rest}
      className={`relative rounded-3xl border border-[rgba(255,255,255,0.18)] bg-[rgba(18,16,40,0.72)] shadow-[0_12px_32px_rgba(8,5,32,0.5)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[2px] hover:border-[rgba(255,255,255,0.26)] hover:shadow-[0_0_22px_rgba(255,62,165,0.24)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(120%_90%_at_14%_4%,rgba(255,255,255,0.14),transparent_48%),radial-gradient(120%_130%_at_86%_96%,rgba(9,7,26,0.5),transparent_62%)]" />
      <div className="pointer-events-none absolute -left-8 top-[-14px] h-20 w-20 rounded-full bg-[#FF3EA51E] blur-2xl" />
      <div className="pointer-events-none absolute -right-8 bottom-[-10px] h-24 w-24 rounded-full bg-[#C084FC1A] blur-2xl" />
      <div className="relative h-full">{children}</div>
    </section>
  );
}
