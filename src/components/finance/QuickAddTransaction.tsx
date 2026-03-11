'use client';

import { useMemo, useState } from 'react';
import { financeApiUrl } from '../../lib/finance-api';

type FormState = {
  amount: string;
  direction: 'expense' | 'income';
  category: string;
  note: string;
  date: string;
};

const CATEGORIES = ['Food', 'Travel', 'Beauty', 'Bills', 'Health', 'Shopping', 'Gifts', 'Other'];

function todayInput() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function QuickAddTransaction({
  onCreated,
}: {
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateMode, setDateMode] = useState<'today' | 'custom'>('today');
  const [form, setForm] = useState<FormState>({
    amount: '',
    direction: 'expense',
    category: 'Food',
    note: '',
    date: todayInput(),
  });

  const validationError = useMemo(() => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than 0.';
    if (!['expense', 'income'].includes(form.direction)) return 'Direction is invalid.';
    if (!form.category.trim()) return 'Category is required.';
    if (dateMode === 'custom' && !isIsoDate(form.date)) return 'Date must be YYYY-MM-DD.';
    return null;
  }, [form, dateMode]);

  const submit = async () => {
    setError(null);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      // Today mode is always auto-resolved to today's ISO date so backend never receives an empty date.
      const payloadDate = dateMode === 'custom' && isIsoDate(form.date) ? form.date : todayInput();

      const response = await fetch(financeApiUrl('/finance/transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(form.amount),
          direction: form.direction,
          category: form.category,
          note: form.note.trim() || null,
          date: payloadDate,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Unable to save transaction.');

      setForm((prev) => ({ ...prev, amount: '', note: '', date: todayInput() }));
      setDateMode('today');
      await onCreated();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save transaction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(255,62,165,0.12),rgba(18,16,40,0.62)_35%,rgba(18,16,40,0.82))] p-3 shadow-[0_0_20px_rgba(255,62,165,0.14)]">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-serif text-lg text-[#F8F4FF]">Quick Add</h4>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-[#FF3EA566] bg-[linear-gradient(135deg,rgba(255,62,165,0.28),rgba(192,132,252,0.22))] px-4 py-1.5 text-xs text-[#F8F4FF] shadow-[0_0_14px_rgba(255,62,165,0.25)] transition hover:-translate-y-[1px] hover:shadow-[0_0_20px_rgba(255,62,165,0.35)]"
        >
          {open ? 'Close' : 'Quick Add Transaction'}
        </button>
      </div>

      {open ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="col-span-2 text-[11px] text-[#B9B4D9]">
              Amount
              <input
                value={form.amount}
                onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                type="number"
                min="0"
                step="0.01"
                className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-[rgba(18,16,40,0.65)] px-2 text-sm text-[#F8F4FF] outline-none transition focus:border-[#FF3EA588] focus:shadow-[0_0_0_2px_rgba(255,62,165,0.18)]"
              />
            </label>

            <label className="text-[11px] text-[#B9B4D9]">
              Direction
              <select
                value={form.direction}
                onChange={(e) => setForm((s) => ({ ...s, direction: e.target.value as 'expense' | 'income' }))}
                className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-[rgba(18,16,40,0.65)] px-2 text-sm text-[#F8F4FF] outline-none transition focus:border-[#FF3EA588] focus:shadow-[0_0_0_2px_rgba(255,62,165,0.18)]"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>

            <label className="text-[11px] text-[#B9B4D9]">
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-[rgba(18,16,40,0.65)] px-2 text-sm text-[#F8F4FF] outline-none transition focus:border-[#FF3EA588] focus:shadow-[0_0_0_2px_rgba(255,62,165,0.18)]"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="col-span-2 text-[11px] text-[#B9B4D9]">
              Note
              <input
                value={form.note}
                onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
                className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-[rgba(18,16,40,0.65)] px-2 text-sm text-[#F8F4FF] outline-none transition focus:border-[#FF3EA588] focus:shadow-[0_0_0_2px_rgba(255,62,165,0.18)]"
                placeholder="Merchant or note"
              />
            </label>

            <label className="col-span-2 text-[11px] text-[#B9B4D9]">
              Date Mode
              <div className="mt-1 inline-flex rounded-full border border-white/15 bg-[rgba(18,16,40,0.65)] p-1">
                <button
                  type="button"
                  onClick={() => setDateMode('today')}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    dateMode === 'today'
                      ? 'border border-[#FF3EA566] bg-[linear-gradient(135deg,rgba(255,62,165,0.28),rgba(192,132,252,0.2))] text-[#F8F4FF] shadow-[0_0_10px_rgba(255,62,165,0.22)]'
                      : 'text-[#B9B4D9] hover:text-[#F8F4FF]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode('custom')}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    dateMode === 'custom'
                      ? 'border border-[#FF3EA566] bg-[linear-gradient(135deg,rgba(255,62,165,0.28),rgba(192,132,252,0.2))] text-[#F8F4FF] shadow-[0_0_10px_rgba(255,62,165,0.22)]'
                      : 'text-[#B9B4D9] hover:text-[#F8F4FF]'
                  }`}
                >
                  Pick date
                </button>
              </div>
            </label>

            {dateMode === 'custom' && (
              <label className="col-span-2 text-[11px] text-[#B9B4D9]">
                Date
                <input
                  value={form.date}
                  onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
                  type="date"
                  className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-[rgba(18,16,40,0.65)] px-2 text-sm text-[#F8F4FF] outline-none transition focus:border-[#FF3EA588] focus:shadow-[0_0_0_2px_rgba(255,62,165,0.18)]"
                />
              </label>
            )}
          </div>

          {error && <p className="mt-2 text-xs text-[#ff9acb]">{error}</p>}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="rounded-full border border-[#FF3EA566] bg-[linear-gradient(135deg,rgba(255,62,165,0.3),rgba(192,132,252,0.22))] px-4 py-1.5 text-xs text-[#F8F4FF] shadow-[0_0_14px_rgba(255,62,165,0.24)] transition hover:-translate-y-[1px] hover:shadow-[0_0_22px_rgba(255,62,165,0.34)] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Transaction'}
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-[#B9B4D9]">Tap the button to add a new transaction quickly.</p>
      )}
    </section>
  );
}
