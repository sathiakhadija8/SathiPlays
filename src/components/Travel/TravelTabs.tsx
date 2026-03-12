'use client';

export type TravelTabKey = 'trips' | 'dream' | 'planner' | 'archive';

const TABS: Array<{ key: TravelTabKey; label: string }> = [
  { key: 'trips', label: '✈️ My Trips' },
  { key: 'dream', label: '🌎 Dream Board' },
  { key: 'planner', label: '🧳 Planner' },
  { key: 'archive', label: '📚 Archive' },
];

export function TravelTabs({
  activeTab,
  onChange,
}: {
  activeTab: TravelTabKey;
  onChange: (tab: TravelTabKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#d7e6ff33] bg-[rgba(195,224,255,0.10)] p-2">
      {TABS.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`relative rounded-full border px-3 py-1.5 text-xs transition-all duration-200 ${
              active
                ? 'border-[#b8d6ff88] bg-[rgba(210,234,255,0.24)] text-[#F2F7FF]'
                : 'border-[#d7e6ff22] bg-[rgba(194,220,255,0.08)] text-[#C9D9EE] hover:border-[#bdd3f27a] hover:text-[#EAF2FF]'
            }`}
          >
            {tab.label}
            {active ? (
              <span className="pointer-events-none absolute -bottom-1 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-[#A8CBFF] shadow-[0_0_10px_rgba(168,203,255,0.8)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
