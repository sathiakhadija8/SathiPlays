'use client';

import { buildMonthGrid, londonTodayYMD } from '../../lib/events-helpers';

type EventsCalendarMonthProps = {
  monthDate: Date;
  countsByDate: Record<string, number>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export function EventsCalendarMonth({
  monthDate,
  countsByDate,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: EventsCalendarMonthProps) {
  const cells = buildMonthGrid(monthDate);
  const monthLabel = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const todayKey = londonTodayYMD();

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="rounded-full border border-white/10 px-2 py-1 font-sans text-xs text-[#B9B4D9] transition-all duration-300 hover:-translate-y-[1px] hover:text-[#F8F4FF]"
        >
          Prev
        </button>
        <h4 className="font-serif text-lg text-[#F8F4FF]">{monthLabel}</h4>
        <button
          type="button"
          onClick={onNextMonth}
          className="rounded-full border border-white/10 px-2 py-1 font-sans text-xs text-[#B9B4D9] transition-all duration-300 hover:-translate-y-[1px] hover:text-[#F8F4FF]"
        >
          Next
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center font-sans text-[10px] uppercase tracking-wide text-[#B9B4D9]">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const count = countsByDate[cell.date] ?? 0;
          const dots = Math.min(3, count);
          const isToday = cell.date === todayKey;
          const isSelected = selectedDate === cell.date;

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onSelectDate(cell.date)}
              className={`rounded-lg border p-1 text-left transition-all duration-300 hover:-translate-y-[1px] ${
                isSelected
                  ? 'border-[#FF3EA599] shadow-[0_0_10px_rgba(255,62,165,0.35)]'
                  : isToday
                    ? 'border-white/40'
                    : 'border-white/10'
              } ${cell.inMonth ? 'bg-white/5' : 'bg-white/[0.02]'}`}
            >
              <div className={`font-sans text-[10px] ${cell.inMonth ? 'text-[#F8F4FF]' : 'text-[#B9B4D980]'}`}>{cell.day}</div>
              <div className="mt-1 flex min-h-[8px] items-center gap-0.5">
                {Array.from({ length: dots }).map((_, idx) => (
                  <span key={idx} className="h-1.5 w-1.5 rounded-full bg-[#FF3EA5]" />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
