import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../lib/travel-server';

type Body = {
  tripId?: unknown;
  planner?: unknown;
};

type PlannerPayload = {
  itinerary?: unknown;
  packing?: unknown;
  packingCards?: unknown;
  budget?: unknown;
};

type PackingCard = {
  id: string;
  title: string;
  icon?: string;
  items: Array<{ id: string; text: string; checked: boolean }>;
};

const DEFAULT_PACKING_CARD_TITLES = ['Clothes', 'Toiletries', 'Tech', 'Documents', 'Misc / Other'] as const;

function toStringSafe(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizePackingCards(value: unknown): PackingCard[] {
  const source = Array.isArray(value) ? value : [];
  const cards: PackingCard[] = [];

  if (
    source.length > 0 &&
    source.every((entry) => typeof entry === 'object' && entry !== null && 'items' in (entry as object))
  ) {
    for (const entry of source as Array<{ id?: unknown; title?: unknown; icon?: unknown; items?: unknown }>) {
      const title = toStringSafe(entry.title).trim();
      if (!title) continue;
      const itemsRaw = Array.isArray(entry.items) ? entry.items : [];
      cards.push({
        id: toStringSafe(entry.id).trim() || `card-${Math.random().toString(16).slice(2, 8)}`,
        title,
        icon: toStringSafe(entry.icon).trim() || undefined,
        items: itemsRaw
          .map((item) => ({
            id:
              typeof item === 'object' && item && 'id' in item && typeof (item as { id?: unknown }).id === 'string'
                ? String((item as { id: string }).id)
                : `item-${Math.random().toString(16).slice(2, 8)}`,
            text:
              typeof item === 'object' && item && 'text' in item
                ? toStringSafe((item as { text?: unknown }).text).trim()
                : '',
            checked:
              typeof item === 'object' && item && 'checked' in item
                ? Boolean((item as { checked?: unknown }).checked)
                : false,
          }))
          .filter((item) => item.text.length > 0),
      });
    }
  } else if (source.length > 0) {
    // Legacy array shape: [{ id, text, category, checked }]
    const grouped = new Map<string, Array<{ id: string; text: string; checked: boolean }>>();
    for (const legacy of source as Array<{ id?: unknown; text?: unknown; category?: unknown; checked?: unknown }>) {
      const text = toStringSafe(legacy.text).trim();
      if (!text) continue;
      const category = toStringSafe(legacy.category, 'Misc / Other').trim() || 'Misc / Other';
      const list = grouped.get(category) ?? [];
      list.push({
        id: toStringSafe(legacy.id).trim() || `item-${Math.random().toString(16).slice(2, 8)}`,
        text,
        checked: Boolean(legacy.checked),
      });
      grouped.set(category, list);
    }
    for (const [title, items] of grouped.entries()) {
      cards.push({
        id: `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(16).slice(2, 6)}`,
        title,
        items,
      });
    }
  }

  const existing = new Set(cards.map((card) => card.title.toLowerCase()));
  for (const title of DEFAULT_PACKING_CARD_TITLES) {
    if (!existing.has(title.toLowerCase())) {
      cards.push({
        id: `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        items: [],
      });
    }
  }
  return cards;
}

export async function PATCH(request: Request) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const body = (await request.json()) as Body;

    const tripId = Number(body.tripId);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return NextResponse.json({ ok: false, message: 'tripId is required.' }, { status: 400 });
    }

    const [tripRows] = await pool.execute<Array<RowDataPacket & { id: number }>>(
      `SELECT id FROM travel_trips WHERE id = ? AND user_id = ? LIMIT 1`,
      [tripId, userId],
    );
    if (tripRows.length === 0) {
      return NextResponse.json({ ok: false, message: 'Trip not found.' }, { status: 404 });
    }

    const planner = (body.planner ?? {}) as PlannerPayload;
    const itinerary = Array.isArray(planner.itinerary) ? planner.itinerary : [];
    const packingSource = planner.packingCards ?? planner.packing;
    const packingCards = normalizePackingCards(packingSource);
    const budget =
      planner.budget && typeof planner.budget === 'object'
        ? planner.budget
        : { flights: 0, hotel: 0, activities: 0, food: 0, misc: 0 };

    await pool.execute<ResultSetHeader>(
      `INSERT INTO travel_planners (user_id, trip_id, itinerary_json, packing_json, budget_json)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         itinerary_json = VALUES(itinerary_json),
         packing_json = VALUES(packing_json),
         budget_json = VALUES(budget_json),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, tripId, JSON.stringify(itinerary), JSON.stringify({ packingCards }), JSON.stringify(budget)],
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save planner.' }, { status: 500 });
  }
}
