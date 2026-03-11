import { NextResponse } from 'next/server';
import { isValidYmd, londonTodayYmd } from '../../../../lib/deen-server';

export const dynamic = 'force-dynamic';

function toProviderDate(ymd: string): string {
  const [year, month, day] = ymd.split('-');
  return `${day}-${month}-${year}`;
}

function normalizeTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = String(Number(match[1])).padStart(2, '0');
  const minutes = match[2];
  return `${hours}:${minutes}`;
}

function parseCoordinate(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date')?.trim() ?? londonTodayYmd();
    if (!isValidYmd(date)) {
      return NextResponse.json({ ok: false, message: 'date must be YYYY-MM-DD.' }, { status: 400 });
    }

    const providerDate = toProviderDate(date);
    const method = Number(process.env.DEEN_PRAYER_METHOD ?? 2);
    const latitude = parseCoordinate(searchParams.get('latitude')) ?? parseCoordinate(process.env.DEEN_PRAYER_LATITUDE ?? null);
    const longitude = parseCoordinate(searchParams.get('longitude')) ?? parseCoordinate(process.env.DEEN_PRAYER_LONGITUDE ?? null);
    const city = process.env.DEEN_PRAYER_CITY ?? 'London';
    const country = process.env.DEEN_PRAYER_COUNTRY ?? 'United Kingdom';

    const endpoint =
      latitude !== null && longitude !== null
        ? `https://api.aladhan.com/v1/timings/${providerDate}?latitude=${latitude}&longitude=${longitude}&method=${method}`
        : `https://api.aladhan.com/v1/timingsByCity/${providerDate}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`;

    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json({ ok: false, message: 'Unable to fetch prayer times right now.' }, { status: 502 });
    }

    const payload = (await response.json()) as {
      data?: {
        timings?: Record<string, string>;
        meta?: { timezone?: string };
      };
    };

    const timings = payload.data?.timings ?? {};
    const fajr = normalizeTime(timings.Fajr);
    const dhuhr = normalizeTime(timings.Dhuhr);
    const asr = normalizeTime(timings.Asr);
    const maghrib = normalizeTime(timings.Maghrib);
    const isha = normalizeTime(timings.Isha);
    const sunrise = normalizeTime(timings.Sunrise);

    if (!fajr || !dhuhr || !asr || !maghrib || !isha) {
      return NextResponse.json({ ok: false, message: 'Prayer times payload is incomplete.' }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      date,
      timezone: payload.data?.meta?.timezone ?? 'Europe/London',
      timings: { fajr, sunrise, dhuhr, asr, maghrib, isha },
      source: latitude !== null && longitude !== null ? 'coordinates' : 'city',
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to fetch prayer times right now.' }, { status: 500 });
  }
}
