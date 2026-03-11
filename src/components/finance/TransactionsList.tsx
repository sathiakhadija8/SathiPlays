'use client';

import type { FinanceTransaction } from '../../hooks/useFinanceTransactions';

function formatDateLabel(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);

  const valueDay = new Date(date);
  valueDay.setHours(0, 0, 0, 0);

  if (valueDay.getTime() === today.getTime()) return 'Today';
  if (valueDay.getTime() === yest.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function TransactionsList({
  items,
  loading,
  error,
  onDelete,
  onViewAll,
}: {
  items: FinanceTransaction[];
  loading: boolean;
  error: string | null;
  onDelete: (id: number) => Promise<void>;
  onViewAll: () => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-serif text-lg text-[#F8F4FF]">Recent Transactions</h4>
        <button
          type="button"
          onClick={onViewAll}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-[#B9B4D9] transition hover:border-[#C084FC66] hover:text-[#F8F4FF]"
        >
          View All Transactions
        </button>
      </div>

      <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
        {loading && <div className="h-24 animate-pulse rounded-xl bg-white/5" />}
        {!loading && error && <p className="text-xs text-[#ff9acb]">{error}</p>}
        {!loading && !error && items.length === 0 && <p className="text-xs text-[#B9B4D9]">No transactions yet.</p>}

        {!loading &&
          !error &&
          items.map((item) => {
            const expense = item.direction === 'expense';
            return (
              <article key={item.id} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm text-[#F8F4FF]">{item.note || 'Untitled transaction'}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-[#B9B4D9]">{item.category}</span>
                      <span className="text-[10px] text-[#B9B4D9]">{formatDateLabel(item.date)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-sans text-sm ${expense ? 'text-[#FF8CCF]' : 'text-[#8FF0C1]'}`}>
                      {expense ? '-' : '+'}£{Number(item.amount).toFixed(2)}
                    </p>
                    <button
                      type="button"
                      onClick={() => void onDelete(item.id)}
                      className="mt-1 text-[10px] text-[#B9B4D9] hover:text-[#F8F4FF]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}
