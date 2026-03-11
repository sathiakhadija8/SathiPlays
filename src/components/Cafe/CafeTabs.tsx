'use client';

type CafeTab = 'books' | 'magazine' | 'places';

const TABS: Array<{ key: CafeTab; label: string }> = [
  { key: 'books', label: '📖 Memory Books' },
  { key: 'magazine', label: '📰 Magazine' },
  { key: 'places', label: '📍 Places' },
];

export function CafeTabs({ activeTab, onTabChange }: { activeTab: CafeTab; onTabChange: (tab: CafeTab) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#d9c7aa]/60 bg-[#fff7ea]/40 p-2">
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-all duration-200 ${
              active
                ? 'border-[#b58f62] bg-[#f8e6cf] text-[#493325] shadow-[0_0_10px_rgba(181,143,98,0.25)]'
                : 'border-[#d9c7aa]/70 bg-[#fff7ea]/45 text-[#7d6650] hover:border-[#c9ae87] hover:text-[#5f4634]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
