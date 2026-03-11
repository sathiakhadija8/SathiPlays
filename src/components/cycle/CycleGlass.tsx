'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GlassCard } from '../GlassCard';
import { formatHHMM } from '../../lib/cycle-helpers';
import { CycleModal, type CycleSummaryResponse } from './CycleModal';

type OpenPayload = {
  tab: 'log' | 'today' | 'history';
  date?: string | null;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function CycleGlass() {
  const activeMonthKey = monthKey(new Date());
  const [summary, setSummary] = useState<CycleSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'log' | 'today' | 'history'>('log');
  const [modalDate, setModalDate] = useState<string | null>(null);

  const fetchSummary = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cycle/summary?month=${month}`, { cache: 'no-store' });
      if (!response.ok) {
        setSummary(null);
        return;
      }
      const payload = (await response.json().catch(() => null)) as CycleSummaryResponse | null;
      setSummary(payload);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(activeMonthKey);
  }, [activeMonthKey, fetchSummary]);

  const openModal = ({ tab, date = null }: OpenPayload) => {
    setModalTab(tab);
    setModalDate(date);
    setModalOpen(true);
  };

  const stats = useMemo(() => {
    const days = summary?.days ?? [];
    const loggedDays = days.filter((day) => day.has_logs).length;
    const periodDays = days.filter((day) => day.has_period).length;
    const bcDays = days.filter((day) => day.has_bc).length;
    const topSymptoms = summary?.top_symptoms_30d?.slice(0, 3) ?? [];
    return { loggedDays, periodDays, bcDays, topSymptoms };
  }, [summary]);

  const statusText = summary?.today_has_logs ? 'Logged today ✓' : 'No log today';
  const lastTime = summary?.latest_log?.created_at ? formatHHMM(summary.latest_log.created_at) : '--:--';

  return (
    <>
      <GlassCard className="cycle-soft-card relative flex h-full min-h-0 flex-col overflow-hidden p-2.5 max-[900px]:p-2">
        <div className="cycle-sparkles pointer-events-none absolute inset-0" aria-hidden />
        <div className="cycle-sparkles cycle-sparkles-delayed pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative z-[1] mb-2 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl text-[#F8F4FF] drop-shadow-[0_0_10px_rgba(255,214,236,0.34)]">Cycle</h2>
            <p className="font-sans text-xs text-[#D5CCE9]">{statusText}</p>
            <p className="font-sans text-xs text-[#CFC6E7]">Last log {lastTime}</p>
          </div>
        </div>

        <div className="relative z-[1] grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 font-sans text-xs text-[#F8F4FF]">
          <div>
            <p className="text-[#B9B4D9]">Today logs</p>
            <p className="mt-0.5">{summary?.today_logs_count ?? 0}</p>
          </div>
          <div>
            <p className="text-[#B9B4D9]">Days logged</p>
            <p className="mt-0.5">{stats.loggedDays}</p>
          </div>
          <div>
            <p className="text-[#B9B4D9]">Period days</p>
            <p className="mt-0.5">{stats.periodDays}</p>
          </div>
          <div>
            <p className="text-[#B9B4D9]">BC days</p>
            <p className="mt-0.5">{stats.bcDays}</p>
          </div>
        </div>

        <div className="relative z-[1] mt-2 rounded-2xl border border-white/10 bg-black/20 p-2">
          <p className="font-sans text-[11px] text-[#B9B4D9]">Top symptoms</p>
          <p className="mt-1 font-sans text-xs text-[#F8F4FF]">{stats.topSymptoms.join(', ') || '--'}</p>
        </div>

        <div className="relative z-[1] mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => openModal({ tab: 'log' })}
            className="rounded-full border border-[#FFD8EE66] bg-[linear-gradient(120deg,rgba(255,214,236,0.18),rgba(192,132,252,0.18))] px-3 py-1 font-sans text-xs text-[#F8F4FF] shadow-[0_0_14px_rgba(255,214,236,0.2)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_0_18px_rgba(255,214,236,0.3)]"
          >
            Log symptoms
          </button>
          <button
            type="button"
            onClick={() => openModal({ tab: 'history', date: summary?.latest_log?.logged_for_date ?? null })}
            className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-300 hover:-translate-y-[1px] hover:bg-white/15"
          >
            History
          </button>
        </div>

        {loading ? <p className="relative z-[1] mt-2 font-sans text-[10px] text-[#CFC6E7]">Loading…</p> : null}
      </GlassCard>

      <CycleModal
        open={modalOpen}
        initialTab={modalTab}
        initialDate={modalDate}
        summary={summary}
        onClose={() => setModalOpen(false)}
        onSaved={() => fetchSummary(activeMonthKey)}
      />
    </>
  );
}
