import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../lib/travel-server';
import { computeDurationDays } from '../../../../lib/travel-dates';

type Body = {
  city?: unknown;
  country?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
  coverImage?: unknown;
  plannedBudget?: unknown;
  spentBudget?: unknown;
  reflection?: unknown;
  gallery?: unknown;
  placesVisited?: unknown;
};

function isTripStatus(value: string): value is 'dream' | 'upcoming' | 'completed' {
  return value === 'dream' || value === 'upcoming' || value === 'completed';
}

function isValidYmd(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function parseNonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function POST(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const body = (await request.json()) as Body;

    const city = String(body.city ?? '').trim();
    const country = String(body.country ?? '').trim();
    const startDate = String(body.startDate ?? '').trim();
    const endDate = String(body.endDate ?? '').trim();
    const status = String(body.status ?? 'dream').trim();
    const coverImage = String(body.coverImage ?? '').trim();
    const plannedBudget = parseNonNegativeNumber(body.plannedBudget ?? 0);
    const spentBudget = parseNonNegativeNumber(body.spentBudget ?? 0);
    const reflection = String(body.reflection ?? '').trim();
    const gallery = Array.isArray(body.gallery) ? body.gallery.filter((v): v is string => typeof v === 'string') : [];
    const placesVisited = Array.isArray(body.placesVisited)
      ? body.placesVisited.filter((v): v is string => typeof v === 'string')
      : [];

    if (!city) return NextResponse.json({ ok: false, message: 'city is required.' }, { status: 400 });
    if (!country) return NextResponse.json({ ok: false, message: 'country is required.' }, { status: 400 });
    if (!isValidYmd(startDate) || !isValidYmd(endDate)) {
      return NextResponse.json({ ok: false, message: 'startDate/endDate are required.' }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json({ ok: false, message: 'endDate must be on or after startDate.' }, { status: 400 });
    }
    if (!isTripStatus(status)) return NextResponse.json({ ok: false, message: 'status is invalid.' }, { status: 400 });
    if (!coverImage) return NextResponse.json({ ok: false, message: 'coverImage is required.' }, { status: 400 });
    if (plannedBudget === null || spentBudget === null) {
      return NextResponse.json({ ok: false, message: 'plannedBudget/spentBudget must be non-negative numbers.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO travel_trips
       (user_id, city, country, start_date, end_date, status, cover_image, planned_budget, spent_budget, reflection, gallery_json, places_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        city,
        country,
        startDate,
        endDate,
        status,
        coverImage,
        plannedBudget,
        spentBudget,
        reflection || null,
        JSON.stringify(gallery),
        JSON.stringify(placesVisited),
      ],
    );

    return NextResponse.json({ ok: true, id: String(result.insertId), duration_days: computeDurationDays(startDate, endDate) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create trip.' }, { status: 500 });
  }
}
