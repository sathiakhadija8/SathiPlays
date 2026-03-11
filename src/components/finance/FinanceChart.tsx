'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '../../lib/finance-api';
import type { FinanceChartPoint } from '../../hooks/useFinanceChart';

export function FinanceChart({
  data,
  loading,
  error,
  title,
}: {
  data: FinanceChartPoint[];
  loading: boolean;
  error: string | null;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-serif text-lg text-[#F8F4FF]">{title}</h4>
      </div>

      {loading ? (
        <div className="h-44 animate-pulse rounded-xl bg-white/5" />
      ) : error ? (
        <div className="grid h-44 place-items-center rounded-xl border border-white/10 bg-black/25">
          <p className="text-xs text-[#B9B4D9]">{error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="grid h-44 place-items-center rounded-xl border border-white/10 bg-black/25">
          <p className="text-xs text-[#B9B4D9]">No chart data yet.</p>
        </div>
      ) : (
        <div className="h-44 rounded-xl border border-white/10 bg-[rgba(18,16,40,0.45)] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#B9B4D9" fontSize={11} />
              <YAxis stroke="#B9B4D9" fontSize={11} />
              <Tooltip
                formatter={(value: number | string | undefined) => money(typeof value === 'number' || typeof value === 'string' ? value : 0)}
                contentStyle={{
                  background: 'rgba(18,16,40,0.92)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  color: '#F8F4FF',
                }}
              />
              <Bar dataKey="value" fill="#FF3EA5" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
