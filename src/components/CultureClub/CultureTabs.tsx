'use client';

export type CultureType = 'movie' | 'series' | 'book';

const TABS: Array<{ type: CultureType; label: string }> = [
  { type: 'movie', label: '🎬 Movies' },
  { type: 'series', label: '📺 Series' },
  { type: 'book', label: '📚 Books' },
];

export function CultureTabs({
  activeType,
  onChange,
}: {
  activeType: CultureType;
  onChange: (type: CultureType) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
      {TABS.map((tab) => (
        <button
          key={tab.type}
          type="button"
          onClick={() => onChange(tab.type)}
          className={`relative rounded-full px-3 py-1.5 text-sm transition-all duration-200 ${
            activeType === tab.type
              ? 'text-[#F8F4FF] bg-[#FF3EA522] border border-[#FF3EA566]'
              : 'text-[#B9B4D9] border border-white/10 bg-black/15 hover:text-[#F8F4FF]'
          }`}
        >
          {tab.label}
          {activeType === tab.type && (
            <span className="pointer-events-none absolute -bottom-1 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-[#FF3EA5] shadow-[0_0_10px_rgba(255,62,165,0.8)]" />
          )}
        </button>
      ))}
    </div>
  );
}
