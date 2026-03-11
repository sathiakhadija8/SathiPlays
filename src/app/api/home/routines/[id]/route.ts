import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

const ROOMS = new Set(['bedroom', 'kitchen', 'living', 'bathroom', 'balcony', 'laundry', 'closet', 'whole_home']);
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly']);
const DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_INDEX = new Map(DAY_ORDER.map((day, index) => [day, index]));

type Body = {
  name?: unknown;
  room?: unknown;
  frequency?: unknown;
  active_days?: unknown;
  time_limit_minutes?: unknown;
  scheduled_time?: unknown;
  is_active?: unknown;
};

function parseId(idRaw: string) {
  const id = Number(idRaw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function daySortIndex(day: string) {
  return DAY_INDEX.get(day as (typeof DAY_ORDER)[number]) ?? 99;
}

function sanitizeDays(value: unknown) {
  if (!Array.isArray(value)) return null;
  const unique = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => DAYS.has(item)),
    ),
  );
  return unique.sort((a, b) => daySortIndex(a) - daySortIndex(b));
}

function parseTimeLimitMinutes(value: unknown) {
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 720) return null;
  return parsed;
}

function normalizeScheduledTime(value: unknown) {
  if (value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
  if (!match) return null;
  const [, hh, mm, ss] = match;
  return `${hh}:${mm}:${ss ?? '00'}`;
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const id = parseId(context.params.id);
    if (!id) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const body = (await request.json()) as Body;
    const name = typeof body.name === 'string' ? body.name.trim() : null;
    const room = typeof body.room === 'string' ? body.room.trim() : null;
    const frequency = typeof body.frequency === 'string' ? body.frequency.trim() : null;
    const activeDays = sanitizeDays(body.active_days);
    const timeLimitMinutes = parseTimeLimitMinutes(body.time_limit_minutes);
    const scheduledTime = normalizeScheduledTime(body.scheduled_time);
    const isActive = typeof body.is_active === 'boolean' ? (body.is_active ? 1 : 0) : null;

    if (name !== null && (!name || name.length > 160)) {
      return NextResponse.json({ ok: false, message: 'name must be <=160.' }, { status: 400 });
    }
    if (room !== null && !ROOMS.has(room)) {
      return NextResponse.json({ ok: false, message: 'room is invalid.' }, { status: 400 });
    }
    if (frequency !== null && !FREQUENCIES.has(frequency)) {
      return NextResponse.json({ ok: false, message: 'frequency is invalid.' }, { status: 400 });
    }
    if (body.active_days !== undefined && !Array.isArray(body.active_days)) {
      return NextResponse.json({ ok: false, message: 'active_days must be an array of weekdays.' }, { status: 400 });
    }
    if (body.active_days !== undefined && activeDays !== null && activeDays.length === 0) {
      return NextResponse.json({ ok: false, message: 'active_days must include at least one weekday.' }, { status: 400 });
    }
    if (body.time_limit_minutes !== undefined && timeLimitMinutes === null) {
      return NextResponse.json({ ok: false, message: 'time_limit_minutes must be an integer between 1 and 720.' }, { status: 400 });
    }
    if (body.scheduled_time !== undefined && !scheduledTime) {
      return NextResponse.json({ ok: false, message: 'scheduled_time must be a valid time (HH:MM or HH:MM:SS).' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE home_routines
       SET name = COALESCE(?, name),
           room = COALESCE(?, room),
           frequency = COALESCE(?, frequency),
           active_days = COALESCE(?, active_days),
           time_limit_minutes = COALESCE(?, time_limit_minutes),
           scheduled_time = COALESCE(?, scheduled_time),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name,
        room,
        frequency,
        activeDays === null ? null : JSON.stringify(activeDays),
        timeLimitMinutes,
        scheduledTime,
        isActive,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Routine not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update routine.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    const id = parseId(context.params.id);
    if (!id) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM home_routines WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Routine not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete routine.' }, { status: 500 });
  }
}
