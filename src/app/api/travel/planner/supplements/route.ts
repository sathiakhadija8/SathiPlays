import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../../lib/travel-server';
import { ensureSupplementSchema, type FrequencyType, type TimeOfDay } from '../../../../../lib/glow-supplements';
import { computeDurationDays, enumerateYmdRange, normalizeYmd, parseYmdToDate } from '../../../../../lib/travel-dates';

export const dynamic = 'force-dynamic';

type TripRow = RowDataPacket & {
  id: number;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
};

type SupplementRow = RowDataPacket & {
  id: number;
  name: string;
  dosage: string | null;
  frequency_type: FrequencyType;
  times_per_day: number;
  day_of_week: number | null;
  days_of_week_json: unknown;
  specific_date: number | null;
  time_of_day: TimeOfDay;
  is_active: number;
};

function parseDaysOfWeek(value: unknown) {
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      raw = null;
    }
  }
  if (!Array.isArray(raw)) return [] as number[];
  const set = new Set<number>();
  for (const entry of raw) {
    const n = Number(entry);
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

function weeklyCountInRange(range: string[], days: number[]) {
  if (range.length === 0 || days.length === 0) return 0;
  const targets = new Set(days);
  let count = 0;
  for (const ymd of range) {
    const date = parseYmdToDate(ymd);
    if (date && targets.has(date.getDay())) count += 1;
  }
  return count;
}

function monthlyCountInRange(range: string[], specificDate: number) {
  if (range.length === 0 || specificDate < 1 || specificDate > 31) return 0;
  let count = 0;
  for (const ymd of range) {
    const date = parseYmdToDate(ymd);
    if (date && date.getDate() === specificDate) count += 1;
  }
  return count;
}

function weekdayLabel(day: number) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return labels[day] ?? String(day);
}

function scheduleLabel(row: SupplementRow, weeklyDays: number[]) {
  const time = row.time_of_day;
  if (row.frequency_type === 'daily') return `Daily • ${time}`;
  if (row.frequency_type === 'weekly') {
    const daysText = weeklyDays.map((day) => weekdayLabel(day)).join(', ');
    return `Weekly (${daysText || 'No days'}) • ${time}`;
  }
  const dateText = Number.isInteger(row.specific_date) ? String(row.specific_date) : '-';
  return `Monthly (day ${dateText}) • ${time}`;
}

export async function GET(request: Request) {
  try {
    await ensureTravelTables();
    await ensureSupplementSchema();
    const userId = getTravelUserId();
    const { searchParams } = new URL(request.url);
    const tripId = Number(searchParams.get('tripId'));
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return NextResponse.json({ ok: false, message: 'tripId is required.' }, { status: 400 });
    }

    const [tripRows] = await pool.execute<TripRow[]>(
      `SELECT id, city, country, start_date, end_date
       FROM travel_trips
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [tripId, userId],
    );
    const trip = tripRows[0];
    if (!trip) {
      return NextResponse.json({ ok: false, message: 'Trip not found.' }, { status: 404 });
    }

    const startYmd = normalizeYmd(trip.start_date);
    const endYmd = normalizeYmd(trip.end_date);
    const durationDays = computeDurationDays(startYmd, endYmd);
    const range = enumerateYmdRange(startYmd, endYmd);

    const [supplementRows] = await pool.execute<SupplementRow[]>(
      `
      SELECT
        id,
        name,
        COALESCE(NULLIF(dosage, ''), NULLIF(dosage_text, '')) AS dosage,
        frequency_type,
        times_per_day,
        day_of_week,
        days_of_week_json,
        specific_date,
        time_of_day,
        is_active
      FROM supplements
      WHERE is_active = 1
      ORDER BY name ASC, id ASC
      `,
    );

    const supplements = supplementRows
      .map((row) => {
        const timesPerDay = Number(row.times_per_day) === 2 ? 2 : 1;
        const parsedWeeklyDays = parseDaysOfWeek(row.days_of_week_json);
        const weeklyDays = parsedWeeklyDays.length > 0 ? parsedWeeklyDays : Number.isInteger(row.day_of_week) ? [Number(row.day_of_week)] : [];

        let doseDays = 0;
        if (row.frequency_type === 'daily') {
          doseDays = durationDays;
        } else if (row.frequency_type === 'weekly') {
          doseDays = weeklyCountInRange(range, weeklyDays);
        } else {
          doseDays = monthlyCountInRange(range, Number.isInteger(row.specific_date) ? Number(row.specific_date) : 0);
        }

        const totalDoses = doseDays * timesPerDay;
        return {
          supplement_id: row.id,
          name: row.name,
          dosage: row.dosage,
          frequency_type: row.frequency_type,
          time_of_day: row.time_of_day,
          times_per_day: timesPerDay,
          schedule: scheduleLabel(row, weeklyDays),
          pack_quantity: totalDoses,
        };
      })
      .filter((entry) => entry.pack_quantity > 0);

    return NextResponse.json({
      trip: {
        id: trip.id,
        city: trip.city,
        country: trip.country,
        start_date: startYmd,
        end_date: endYmd,
        duration_days: durationDays,
      },
      supplements,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to compute supplements packing.' }, { status: 500 });
  }
}
