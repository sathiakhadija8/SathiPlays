import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../lib/travel-server';

type ForgottenRow = RowDataPacket & {
  id: number;
  item_text: string;
  miss_count: number;
  last_trip_id: number | null;
  last_seen_at: string;
};

type Body = {
  tripId?: unknown;
  items?: unknown;
};

export async function GET(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(30, Number(searchParams.get('limit') ?? 10) || 10));

    const [rows] = await pool.execute<ForgottenRow[]>(
      `SELECT id, item_text, miss_count, last_trip_id, last_seen_at
       FROM travel_forgotten_items
       WHERE user_id = ?
       ORDER BY miss_count DESC, last_seen_at DESC
       LIMIT ${limit}`,
      [userId],
    );
    return NextResponse.json(
      rows.map((row) => ({
        id: String(row.id),
        item: row.item_text,
        missCount: Number(row.miss_count ?? 0),
        lastTripId: row.last_trip_id ? String(row.last_trip_id) : null,
        lastSeenAt: String(row.last_seen_at),
      })),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load forgotten items.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const body = (await request.json()) as Body;
    const tripId = Number(body.tripId);
    const items = Array.isArray(body.items)
      ? body.items
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    if (!Number.isInteger(tripId) || tripId <= 0) return NextResponse.json({ ok: false, message: 'tripId is required.' }, { status: 400 });
    if (items.length === 0) return NextResponse.json({ ok: false, message: 'items are required.' }, { status: 400 });

    for (const item of items.slice(0, 40)) {
      await pool.execute<ResultSetHeader>(
        `INSERT INTO travel_forgotten_items (user_id, item_text, miss_count, last_trip_id)
         VALUES (?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE
           miss_count = miss_count + 1,
           last_trip_id = VALUES(last_trip_id),
           last_seen_at = CURRENT_TIMESTAMP`,
        [userId, item, tripId],
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save forgotten items.' }, { status: 500 });
  }
}
