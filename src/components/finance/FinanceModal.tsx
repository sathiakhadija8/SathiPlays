'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BudgetRing } from './BudgetRing';
import { FinanceChart } from './FinanceChart';
import { TransactionsList } from './TransactionsList';
import { QuickAddTransaction } from './QuickAddTransaction';
import { type FinanceView, formatMonthLabel, money, shiftMonth } from '../../lib/finance-api';
import { useFinanceSummary } from '../../hooks/useFinanceSummary';
import { useFinanceTransactions } from '../../hooks/useFinanceTransactions';
import { useFinanceChart } from '../../hooks/useFinanceChart';
import { financeApiUrl } from '../../lib/finance-api';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

const CATEGORY_CHIPS = ['All', 'Food', 'Travel', 'Beauty', 'Bills', 'Health', 'Shopping', 'Gifts', 'Other'];
const BUDGET_CATEGORIES = CATEGORY_CHIPS.filter((c) => c !== 'All');

function parseBudgetInput(value: string | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}

export function FinanceModal({
  open,
  month,
  onClose,
}: {
  open: boolean;
  month: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(month);
  const [view, setView] = useState<FinanceView>('today');
  const [category, setCategory] = useState<string>('All');
  const [limit, setLimit] = useState(6);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [categoryBudgetDrafts, setCategoryBudgetDrafts] = useState<Record<string, string>>({});
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState<string | null>(null);
  usePlatformWindowOpen(open);

  const apiCategory = category === 'All' ? undefined : category;

  const summary = useFinanceSummary(selectedMonth, view);
  const transactions = useFinanceTransactions(selectedMonth, limit, apiCategory);
  const chartView = view === 'month' ? 'month' : 'week';
  const chart = useFinanceChart(selectedMonth, chartView, view !== 'today');

  useEffect(() => {
    if (!open) return;
    setSelectedMonth(month);
    setView('today');
    setCategory('All');
    setLimit(6);
    setBudgetModalOpen(false);
    setBudgetMessage(null);
  }, [open, month]);

  useEffect(() => {
    setBudgetDraft(String(Number(summary.data?.total_budget ?? 0)));
  }, [summary.data?.total_budget, selectedMonth]);

  const autoBudgetTotal = useMemo(
    () => BUDGET_CATEGORIES.reduce((sum, categoryName) => sum + parseBudgetInput(categoryBudgetDrafts[categoryName]), 0),
    [categoryBudgetDrafts],
  );

  useEffect(() => {
    if (!budgetModalOpen) return;
    setBudgetDraft(autoBudgetTotal.toFixed(2));
  }, [autoBudgetTotal, budgetModalOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const refreshAll = async () => {
    summary.refetch();
    transactions.refetch();
    chart.refetch();
  };

  const saveBudget = async () => {
    setBudgetMessage(null);
    const numeric = autoBudgetTotal;
    if (!Number.isFinite(numeric) || numeric < 0) {
      setBudgetMessage('Enter a valid non-negative budget.');
      return;
    }

    setBudgetSaving(true);
    try {
      const category_limits = Object.fromEntries(
        BUDGET_CATEGORIES.map((category) => {
          const value = parseBudgetInput(categoryBudgetDrafts[category]);
          return [category, value];
        }),
      );

      const response = await fetch(financeApiUrl('/finance/budget'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth, total_budget: numeric, category_limits }),
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Unable to save budget.');

      setBudgetMessage('Budget saved ✓');
      await refreshAll();
      setBudgetModalOpen(false);
    } catch (err) {
      setBudgetMessage(err instanceof Error ? err.message : 'Unable to save budget.');
    } finally {
      setBudgetSaving(false);
    }
  };

  const deleteTransaction = async (id: number) => {
    await fetch(financeApiUrl(`/finance/transactions/${id}`), { method: 'DELETE' });
    await refreshAll();
  };

  const topCategory = summary.data?.top_category;

  const ringData = useMemo(() => {
    const budget = Number(summary.data?.total_budget ?? 0);
    const spentByView =
      view === 'today'
        ? Number(summary.data?.spent_today ?? 0)
        : view === 'week'
          ? Number(summary.data?.spent_week ?? 0)
          : Number(summary.data?.spent_month ?? 0);

    const label = view === 'today' ? 'Today vs Monthly Budget' : view === 'week' ? 'This Week vs Monthly Budget' : 'This Month vs Monthly Budget';

    return { spent: spentByView, budget, label };
  }, [summary.data, view]);

  if (!open || !mounted) return null;

  const modalNode = (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (!panelRef.current) return;
        if (panelRef.current.contains(event.target as Node)) return;
        onClose();
      }}
    >
      <div
        ref={panelRef}
        className="finance-modal-enter flex h-[min(88vh,820px)] w-[min(96vw,1100px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.88)] shadow-[0_0_36px_rgba(255,62,165,0.22)]"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-serif text-2xl text-[#F8F4FF]">💰 SathiPlays Finance</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))} className="rounded-full border border-white/20 px-2 py-1 text-xs text-[#B9B4D9]">◀</button>
              <span className="rounded-full border border-[#C084FC66] bg-[#C084FC1A] px-3 py-1 text-xs text-[#F8F4FF]">{formatMonthLabel(selectedMonth)}</span>
              <button onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))} className="rounded-full border border-white/20 px-2 py-1 text-xs text-[#B9B4D9]">▶</button>
            </div>

            <div className="flex items-center rounded-full border border-white/20 bg-black/20 p-1">
              {(['today', 'week', 'month'] as FinanceView[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  className={`rounded-full px-3 py-1 text-xs capitalize transition ${view === option ? 'bg-[#FF3EA522] text-[#F8F4FF]' : 'text-[#B9B4D9]'}`}
                >
                  {option}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setCategoryBudgetDrafts(
                  Object.fromEntries(BUDGET_CATEGORIES.map((categoryName) => [categoryName, '0'])),
                );
                setBudgetDraft('0.00');
                setBudgetMessage(null);
                setBudgetModalOpen(true);
                void (async () => {
                  try {
                    const response = await fetch(financeApiUrl('/finance/budget', { month: selectedMonth }), {
                      cache: 'no-store',
                    });
                    const payload = (await response.json()) as {
                      total_budget?: number;
                      category_limits?: Record<string, number>;
                    };
                    if (!response.ok) return;
                    setBudgetDraft(String(Number(payload.total_budget ?? 0)));
                    const nextCategoryDrafts: Record<string, string> = {};
                    BUDGET_CATEGORIES.forEach((category) => {
                      nextCategoryDrafts[category] = String(Number(payload.category_limits?.[category] ?? 0));
                    });
                    setCategoryBudgetDrafts(nextCategoryDrafts);
                  } catch {
                    // keep current drafts if budget fetch fails
                  }
                })();
              }}
              className="rounded-full border border-[#FF3EA566] bg-[linear-gradient(135deg,rgba(255,62,165,0.28),rgba(192,132,252,0.22))] px-4 py-1.5 text-xs text-[#F8F4FF] shadow-[0_0_12px_rgba(255,62,165,0.2)] transition hover:-translate-y-[1px]"
            >
              Edit Budget
            </button>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-[42%_58%]">
            <div className="space-y-3">
              <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.1em] text-[#B9B4D9]">Top Category Alerts</p>
                <div className="space-y-2">
                  {(summary.data?.top_alert_categories ?? []).length === 0 && (
                    <p className="text-xs text-[#B9B4D9]">No category limits set yet.</p>
                  )}
                  {(summary.data?.top_alert_categories ?? []).map((item) => (
                    <div key={item.category} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-[#F8F4FF]">{item.category}</p>
                        <p className={`text-xs ${item.is_over ? 'text-[#FF8DAA]' : item.is_close ? 'text-[#FFD38A]' : 'text-[#B9B4D9]'}`}>
                          {item.used_pct}% used
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] text-[#B9B4D9]">
                        {money(item.spent)} / {money(item.limit)} · Remaining {money(item.remaining)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <BudgetRing {...ringData} />
            </div>

            <section className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
              <Stat title="Spent Today" value={money(summary.data?.spent_today)} />
              <Stat title="This Week" value={money(summary.data?.spent_week)} />
              <Stat title="Spent Month" value={money(summary.data?.spent_month)} />
              <Stat title="Avg/Day" value={money(summary.data?.avg_per_day)} />
              <Stat title="Trend %" value={`${Number(summary.data?.trend_pct ?? 0)}%`} />
              <Stat title="Top Category" value={topCategory ? `${topCategory.name} (${money(topCategory.amount)})` : '—'} />
            </section>
          </div>

          {view !== 'today' && (
            <div className="mb-3">
              <FinanceChart
                data={chart.data}
                loading={chart.loading}
                error={chart.error}
                title={view === 'week' ? 'Weekly Spend (Mon–Sun)' : 'Monthly Spend by Week'}
              />
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-2">
            {CATEGORY_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setCategory(chip)}
                className={`rounded-full border px-3 py-1 text-[11px] transition ${
                  chip === category
                    ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]'
                    : 'border-white/20 bg-black/20 text-[#B9B4D9]'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[56%_44%]">
            <TransactionsList
              items={transactions.data}
              loading={transactions.loading}
              error={transactions.error}
              onDelete={deleteTransaction}
              onViewAll={() => setLimit((prev) => (prev >= 20 ? 6 : 20))}
            />

            <QuickAddTransaction onCreated={refreshAll} />
          </div>

          {(summary.loading || transactions.loading) && (
            <p className="mt-3 text-xs text-[#B9B4D9]">Refreshing finance data...</p>
          )}

          {summary.error && <p className="mt-2 text-xs text-[#ff9acb]">{summary.error}</p>}
        </div>
      </div>

      {budgetModalOpen && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-black/35 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) setBudgetModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.92)] p-4 shadow-[0_0_28px_rgba(255,62,165,0.22)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 className="font-serif text-xl text-[#F8F4FF]">Monthly Budget</h3>
            <p className="mt-1 text-xs text-[#B9B4D9]">{formatMonthLabel(selectedMonth)}</p>
            <label className="mt-3 block text-[11px] text-[#B9B4D9]">
              Overall Monthly Budget
              <input
                type="number"
                min="0"
                step="0.01"
                value={budgetDraft}
                readOnly
                className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[rgba(18,16,40,0.65)] px-3 text-sm text-[#F8F4FF] outline-none transition focus:border-[#FF3EA588] focus:shadow-[0_0_0_2px_rgba(255,62,165,0.18)]"
              />
            </label>
            <p className="mt-1 text-[11px] text-[#B9B4D9]">Auto-calculated from category goals.</p>
            <div className="mt-3">
              <p className="mb-2 text-[11px] text-[#B9B4D9]">Category Goals</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {BUDGET_CATEGORIES.map((category) => (
                  <label key={category} className="text-[11px] text-[#B9B4D9]">
                    {category}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={categoryBudgetDrafts[category] ?? '0'}
                      onChange={(e) =>
                        setCategoryBudgetDrafts((prev) => ({
                          ...prev,
                          [category]: e.target.value,
                        }))
                      }
                      className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-[rgba(18,16,40,0.65)] px-2 text-sm text-[#F8F4FF] outline-none transition focus:border-[#FF3EA588] focus:shadow-[0_0_0_2px_rgba(255,62,165,0.18)]"
                    />
                  </label>
                ))}
              </div>
            </div>
            {budgetMessage && <p className="mt-2 text-xs text-[#B9B4D9]">{budgetMessage}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBudgetModalOpen(false)}
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-[#B9B4D9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveBudget()}
                disabled={budgetSaving}
                className="rounded-full border border-[#FF3EA566] bg-[linear-gradient(135deg,rgba(255,62,165,0.3),rgba(192,132,252,0.22))] px-4 py-1.5 text-xs text-[#F8F4FF] shadow-[0_0_14px_rgba(255,62,165,0.24)] transition hover:-translate-y-[1px] disabled:opacity-60"
              >
                {budgetSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalNode, document.body);
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.1em] text-[#B9B4D9]">{title}</p>
      <p className="mt-1 text-sm text-[#F8F4FF]">{value}</p>
    </div>
  );
}
