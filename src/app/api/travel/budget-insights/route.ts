import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureTravelTables, getTravelUserId, parseObject } from '../../../../lib/travel-server';
import { computeDurationDays, enumerateYmdRange } from '../../../../lib/travel-dates';

type TripRow = RowDataPacket & {
  id: number;
  start_date: string;
  end_date: string;
  planned_budget: number;
  spent_budget: number;
};

type PlannerRow = RowDataPacket & {
  budget_json: string | null;
};

function londonTodayYmd() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const { searchParams } = new URL(request.url);
    const tripId = Number(searchParams.get('tripId'));
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return NextResponse.json({ ok: false, message: 'tripId is required.' }, { status: 400 });
    }

    const [tripRows] = await pool.execute<TripRow[]>(
      `SELECT id, start_date, end_date, planned_budget, spent_budget
       FROM travel_trips
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [tripId, userId],
    );
    const trip = tripRows[0];
    if (!trip) return NextResponse.json({ ok: false, message: 'Trip not found.' }, { status: 404 });

    const startYmd = String(trip.start_date).slice(0, 10);
    const endYmd = String(trip.end_date).slice(0, 10);
    const totalDays = computeDurationDays(startYmd, endYmd);
    const elapsedDays = enumerateYmdRange(startYmd, londonTodayYmd()).length;
    const boundedElapsedDays = Math.max(1, Math.min(totalDays || 1, elapsedDays || 1));

    const planned = Number(trip.planned_budget ?? 0);
    const spent = Number(trip.spent_budget ?? 0);
    const remaining = planned - spent;
    const targetDaily = totalDays > 0 ? planned / totalDays : planned;
    const actualDaily = spent / boundedElapsedDays;
    const paceDelta = actualDaily - targetDaily;

    const [plannerRows] = await pool.execute<PlannerRow[]>(
      `SELECT budget_json FROM travel_planners WHERE user_id = ? AND trip_id = ? LIMIT 1`,
      [userId, tripId],
    );
    const categories = parseObject(
      plannerRows[0]?.budget_json ?? null,
      { flights: 0, hotel: 0, activities: 0, food: 0, misc: 0 },
    ) as Record<string, number>;

    const categoryBreakdown = Object.entries(categories).map(([key, value]) => ({
      category: key,
      amount: Number(value ?? 0),
    }));

    return NextResponse.json({
      planned,
      spent,
      remaining,
      totalDays,
      elapsedDays: boundedElapsedDays,
      targetDaily: Number(targetDaily.toFixed(2)),
      actualDaily: Number(actualDaily.toFixed(2)),
      paceDelta: Number(paceDelta.toFixed(2)),
      paceStatus: paceDelta > 0 ? 'over' : paceDelta < 0 ? 'under' : 'on-track',
      categoryBreakdown,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to compute budget insights.' }, { status: 500 });
  }
}
