import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureSupplementSchema, type FrequencyType, type IntakeMode, type TimeOfDay } from '../../../../../lib/glow-supplements';

export const dynamic = 'force-dynamic';

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
  primary_time: string | null;
  secondary_time: string | null;
  intake_mode: IntakeMode;
  is_active: number;
  created_at: string;
};

function parseDaysOfWeek(value: unknown): number[] {
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      raw = null;
    }
  }
  if (!Array.isArray(raw)) return [];
  const unique = new Set<number>();
  for (const entry of raw) {
    const n = Number(entry);
    if (Number.isInteger(n) && n >= 0 && n <= 6) unique.add(n);
  }
  return [...unique].sort((a, b) => a - b);
}

export async function GET() {
  try {
    await ensureSupplementSchema();

    const [supplements] = await pool.execute<SupplementRow[]>(
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
        primary_time,
        secondary_time,
        intake_mode,
        is_active,
        created_at
      FROM supplements
      ORDER BY created_at DESC, id DESC
      `,
    );

    return NextResponse.json(
      supplements.map((row) => {
        const weeklyDays = parseDaysOfWeek(row.days_of_week_json);
        const { days_of_week_json, ...rest } = row;
        return {
          ...rest,
          days_of_week: weeklyDays.length > 0 ? weeklyDays : row.day_of_week === null ? [] : [Number(row.day_of_week)],
        };
      }),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load supplements system.' }, { status: 500 });
  }
}
