import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../../../lib/db';
import { ensureSupplementSchema, syncSupplementFutureLogs, type FrequencyType, type IntakeMode, type TimeOfDay } from '../../../../../../../lib/glow-supplements';

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
    const day = Number(entry);
    if (Number.isInteger(day) && day >= 0 && day <= 6) unique.add(day);
  }
  return [...unique].sort((a, b) => a - b);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureSupplementSchema();
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const [rows] = await pool.execute<SupplementRow[]>(
      `
      SELECT id, name, COALESCE(NULLIF(dosage, ''), NULLIF(dosage_text, '')) AS dosage,
             frequency_type, times_per_day, day_of_week, days_of_week_json, specific_date, time_of_day, primary_time, secondary_time, intake_mode, is_active
      FROM supplements
      WHERE id = ?
      LIMIT 1
      `,
      [id],
    );
    const current = rows[0];
    if (!current) {
      return NextResponse.json({ ok: false, message: 'Supplement not found.' }, { status: 404 });
    }

    const body = (await request.json()) as Body;
    const name = asString(body.name) || current.name;
    const dosage = body.dosage === undefined ? current.dosage : asString(body.dosage);
    const frequencyType = body.frequency_type === undefined ? normalizeFrequency(current.frequency_type) : normalizeFrequency(body.frequency_type);
    const timesPerDay = body.times_per_day === undefined ? (Number(current.times_per_day) === 2 ? 2 : 1) : Number(body.times_per_day) === 2 ? 2 : 1;
    const currentWeeklyDays = normalizeDaysOfWeek(current.days_of_week_json);
    const weeklyDaysBase =
      body.days_of_week === undefined
        ? currentWeeklyDays.length > 0
          ? currentWeeklyDays
          : current.day_of_week === null
            ? []
            : [Number(current.day_of_week)]
        : normalizeDaysOfWeek(body.days_of_week);
    const dayOfWeekRaw = body.day_of_week === undefined ? current.day_of_week : Number(body.day_of_week);
    const weeklyDays =
      body.days_of_week === undefined &&
      body.day_of_week !== undefined &&
      dayOfWeekRaw !== null &&
      Number.isInteger(dayOfWeekRaw) &&
      dayOfWeekRaw >= 0 &&
      dayOfWeekRaw <= 6
        ? [dayOfWeekRaw]
        : weeklyDaysBase;
    const specificDateRaw = body.specific_date === undefined ? current.specific_date : Number(body.specific_date);
    const timeOfDay = body.time_of_day === undefined ? normalizeTimeOfDay(current.time_of_day) : normalizeTimeOfDay(body.time_of_day);
    const currentPrimaryTime = normalizeClockTime(current.primary_time) ?? defaultPrimaryTime(normalizeTimeOfDay(current.time_of_day));
    const primaryTime = body.primary_time === undefined ? currentPrimaryTime : normalizeClockTime(body.primary_time);
    const currentSecondaryTime = normalizeClockTime(current.secondary_time) ?? defaultSecondaryTime(currentPrimaryTime);
    const secondaryTime = timesPerDay === 2 ? (body.secondary_time === undefined ? currentSecondaryTime : normalizeClockTime(body.secondary_time)) : null;
    const intakeMode = body.intake_mode === undefined ? normalizeIntakeMode(current.intake_mode) : normalizeIntakeMode(body.intake_mode);
    const isActive = body.is_active === undefined ? Number(current.is_active) : Number(body.is_active) ? 1 : 0;

    if (!name) {
      return NextResponse.json({ ok: false, message: 'name is required.' }, { status: 400 });
    }
    if (frequencyType === 'weekly' && weeklyDays.length === 0) {
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
    if (!primaryTime) {
      return NextResponse.json({ ok: false, message: 'Invalid primary_time.' }, { status: 400 });
    }
    if (timesPerDay === 2 && (!secondaryTime || secondaryTime === primaryTime)) {
      return NextResponse.json({ ok: false, message: 'Choose two different times for 2/day supplements.' }, { status: 400 });
    }

    const dayOfWeek = frequencyType === 'weekly' ? (weeklyDays[0] ?? dayOfWeekRaw) : null;
    const daysOfWeekJson = frequencyType === 'weekly' ? JSON.stringify(weeklyDays) : null;
    const specificDate = frequencyType === 'monthly' ? specificDateRaw : null;

    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE supplements
      SET
        name = ?,
        dosage = ?,
        dosage_text = ?,
        frequency_type = ?,
        times_per_day = ?,
        day_of_week = ?,
        days_of_week_json = ?,
        specific_date = ?,
        time_of_day = ?,
        primary_time = ?,
        secondary_time = ?,
        intake_mode = ?,
        timing = ?,
        is_active = ?
      WHERE id = ?
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
        id,
      ],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Supplement not found.' }, { status: 404 });
    }

    await syncSupplementFutureLogs(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update supplement.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureSupplementSchema();
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM supplements WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Supplement not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete supplement.' }, { status: 500 });
  }
}
