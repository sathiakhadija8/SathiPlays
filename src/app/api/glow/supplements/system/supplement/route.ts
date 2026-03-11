import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';
import { ensureSupplementSchema, syncSupplementFutureLogs, type FrequencyType, type IntakeMode, type TimeOfDay } from '../../../../../../lib/glow-supplements';

export const dynamic = 'force-dynamic';

type Body = {
  name?: unknown;
  dosage?: unknown;
  frequency_type?: unknown;
  times_per_day?: unknown;
  day_of_week?: unknown;
  days_of_week?: unknown;
  specific_date?: unknown;
  time_of_day?: unknown;
  primary_time?: unknown;
  secondary_time?: unknown;
  intake_mode?: unknown;
  is_active?: unknown;
};

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeFrequency(value: unknown): FrequencyType {
  return value === 'weekly' || value === 'monthly' ? value : 'daily';
}

function normalizeTimeOfDay(value: unknown): TimeOfDay {
  return value === 'evening' || value === 'night' ? value : 'morning';
}

function normalizeClockTime(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) return trimmed;
  if (/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(trimmed)) return trimmed.slice(0, 5);
  return null;
}

function defaultPrimaryTime(timeOfDay: TimeOfDay) {
  if (timeOfDay === 'evening') return '18:00';
  if (timeOfDay === 'night') return '22:00';
  return '08:00';
}

function defaultSecondaryTime(primaryTime: string) {
  return primaryTime < '12:00' ? '20:00' : '08:00';
}

function normalizeIntakeMode(value: unknown): IntakeMode {
  return value === 'empty_stomach' ? value : 'with_food';
}

function normalizeDaysOfWeek(value: unknown) {
  if (!Array.isArray(value)) return [];
  const unique = new Set<number>();
  for (const entry of value) {
    const day = Number(entry);
    if (Number.isInteger(day) && day >= 0 && day <= 6) unique.add(day);
  }
  return [...unique].sort((a, b) => a - b);
}

export async function POST(request: Request) {
  try {
    await ensureSupplementSchema();
    const body = (await request.json()) as Body;
    const name = asString(body.name);
    const dosage = asString(body.dosage);
    const frequencyType = normalizeFrequency(body.frequency_type);
    const timesPerDay = Number(body.times_per_day) === 2 ? 2 : 1;
    const weeklyDays = normalizeDaysOfWeek(body.days_of_week);
    const dayOfWeekRaw = body.day_of_week === undefined ? null : Number(body.day_of_week);
    const specificDateRaw = body.specific_date === undefined ? null : Number(body.specific_date);
    const timeOfDay = normalizeTimeOfDay(body.time_of_day);
    const primaryTimeRaw = normalizeClockTime(body.primary_time);
    const secondaryTimeRaw = normalizeClockTime(body.secondary_time);
    const primaryTime = primaryTimeRaw ?? defaultPrimaryTime(timeOfDay);
    const secondaryTime = timesPerDay === 2 ? secondaryTimeRaw ?? defaultSecondaryTime(primaryTime) : null;
    const intakeMode = normalizeIntakeMode(body.intake_mode);
    const isActive = body.is_active === undefined ? 1 : Number(body.is_active) ? 1 : 0;

    if (!name) {
      return NextResponse.json({ ok: false, message: 'name is required.' }, { status: 400 });
    }
    const weeklyDaysResolved =
      weeklyDays.length > 0
        ? weeklyDays
        : Number.isInteger(dayOfWeekRaw) && dayOfWeekRaw !== null && dayOfWeekRaw >= 0 && dayOfWeekRaw <= 6
          ? [dayOfWeekRaw]
          : [];
    if (frequencyType === 'weekly' && weeklyDaysResolved.length === 0) {
      return NextResponse.json({ ok: false, message: 'days_of_week must include at least one weekday for weekly frequency.' }, { status: 400 });
    }
    const monthlyDateValid =
      specificDateRaw !== null &&
      Number.isInteger(specificDateRaw) &&
      specificDateRaw >= 1 &&
      specificDateRaw <= 31;
    if (frequencyType === 'monthly' && !monthlyDateValid) {
      return NextResponse.json({ ok: false, message: 'specific_date must be 1..31 for monthly frequency.' }, { status: 400 });
    }
    if (timesPerDay === 2 && (!secondaryTime || secondaryTime === primaryTime)) {
      return NextResponse.json({ ok: false, message: 'Choose two different times for 2/day supplements.' }, { status: 400 });
    }

    const dayOfWeek = frequencyType === 'weekly' ? (weeklyDaysResolved[0] ?? dayOfWeekRaw) : null;
    const daysOfWeekJson = frequencyType === 'weekly' ? JSON.stringify(weeklyDaysResolved) : null;
    const specificDate = frequencyType === 'monthly' ? specificDateRaw : null;

    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO supplements
        (name, dosage, dosage_text, frequency_type, times_per_day, day_of_week, days_of_week_json, specific_date, time_of_day, primary_time, secondary_time, intake_mode, timing, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name.slice(0, 160),
        dosage ? dosage.slice(0, 120) : null,
        dosage ? dosage.slice(0, 120) : null,
        frequencyType,
        timesPerDay,
        dayOfWeek,
        daysOfWeekJson,
        specificDate,
        timeOfDay,
        primaryTime,
        secondaryTime,
        intakeMode,
        frequencyType,
        isActive,
      ],
    );

    await syncSupplementFutureLogs(result.insertId);
    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create supplement.' }, { status: 500 });
  }
}
