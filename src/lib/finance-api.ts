export type FinanceView = 'today' | 'week' | 'month';

const DEFAULT_BASE = '/api';

function normalizedBase() {
  const fromEnv = process.env.NEXT_PUBLIC_FINANCE_API_BASE?.trim();
  if (!fromEnv) return DEFAULT_BASE;
  return fromEnv.endsWith('/') ? fromEnv.slice(0, -1) : fromEnv;
}

export function financeApiUrl(path: string, params?: Record<string, string | number | undefined | null>) {
  const base = normalizedBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  let url: URL;

  try {
    if (base.startsWith('http://') || base.startsWith('https://')) {
      const absoluteBase = base.endsWith('/') ? base : `${base}/`;
      url = new URL(normalizedPath.replace(/^\//, ''), absoluteBase);
    } else {
      const normalizedRelativeBase = base.startsWith('/') ? base : `/${base}`;
      url = new URL(`${normalizedRelativeBase}${normalizedPath}`, origin);
    }
  } catch {
    // Never crash the UI on malformed env values.
    url = new URL(`${DEFAULT_BASE}${normalizedPath}`, origin);
  }

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }

  if (url.origin !== origin) return url.toString();
  return `${url.pathname}${url.search}`;
}

export function monthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function shiftMonth(month: string, delta: number) {
  const [year, mm] = month.split('-').map(Number);
  const next = new Date(year, (mm || 1) - 1 + delta, 1);
  return monthKey(next);
}

export function formatMonthLabel(month: string) {
  const [year, mm] = month.split('-').map(Number);
  const date = new Date(year, (mm || 1) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function money(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}
