'use client';

type BudgetRingProps = {
  spent: number;
  budget: number;
  label?: string;
};

export function BudgetRing({ spent, budget, label = 'Selected View vs Budget' }: BudgetRingProps) {
  const size = 130;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeSpent = Number.isFinite(spent) ? Math.max(0, spent) : 0;
  const safeBudget = Number.isFinite(budget) ? Math.max(0, budget) : 0;
  const rawUsedPercent = safeBudget > 0 ? (safeSpent / safeBudget) * 100 : 0;
  const usedPercent = Math.max(0, Math.min(100, Math.round(rawUsedPercent)));
  const safeRemaining = safeBudget > 0 ? Math.max(0, 100 - usedPercent) : 0;
  const dashOffset = circumference - (usedPercent / 100) * circumference;
  const overBy = safeBudget > 0 ? Math.max(0, safeSpent - safeBudget) : 0;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="relative h-[130px] w-[130px]">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#budgetGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 260ms ease' }}
          />
          <defs>
            <linearGradient id="budgetGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF3EA5" />
              <stop offset="100%" stopColor="#C084FC" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <p className="font-sans text-lg text-[#F8F4FF]">{safeRemaining}%</p>
          <p className="font-sans text-[10px] text-[#B9B4D9]">Remaining</p>
        </div>
      </div>
      <div className="space-y-1 text-xs">
        <p className="font-sans text-[#F8F4FF]">Spent: £{safeSpent.toFixed(2)}</p>
        <p className="font-sans text-[#B9B4D9]">Budget: £{safeBudget.toFixed(2)}</p>
        <p className="font-sans text-[#B9B4D9]">{label}</p>
        {overBy > 0 && <p className="font-sans text-[#FF8CCF]">Over by £{overBy.toFixed(2)}</p>}
      </div>
    </div>
  );
}
