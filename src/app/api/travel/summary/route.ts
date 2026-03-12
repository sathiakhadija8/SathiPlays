import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureTravelTables, getTravelUserId, parseObject, parseStringArray } from '../../../../lib/travel-server';
import { computeDurationDays, normalizeYmd } from '../../../../lib/travel-dates';
import { isDataImageUrl, persistTravelImage, persistTravelImages } from '../../../../lib/travel-image-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type TripRow = RowDataPacket & {
  id: number;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  status: 'dream' | 'upcoming' | 'completed';
  cover_image: string;
  planned_budget: number;
  spent_budget: number;
  reflection: string | null;
  gallery_json: string;
  places_json: string;
};

type DreamRow = RowDataPacket & {
  id: number;
  city: string;
  country: string;
  image: string;
  budget_estimate: number;
  trip_type: 'UK' | 'Overseas';
  why_text: string | null;
  vibe: 'Solo' | 'Friends' | 'Romantic' | 'Cultural';
  savings_goal: number;
  saved_amount: number;
};

type PlannerRow = RowDataPacket & {
  trip_id: number;
  itinerary_json: string;
  packing_json: string;
  budget_json: string;
};

type LegacyPackingItem = {
  id?: unknown;
  text?: unknown;
  category?: unknown;
  checked?: unknown;
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

function sanitizeImageUrl(value: string) {
  return value.startsWith('blob:') ? '' : value;
}

function sanitizeImageList(values: string[]) {
  return values.filter((value) => !value.startsWith('blob:'));
}

function toPackingCards(raw: unknown): PackingCard[] {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as { packingCards?: unknown }).packingCards)
      ? (raw as { packingCards: unknown[] }).packingCards
      : Array.isArray(raw)
        ? raw
        : [];

  const cards: PackingCard[] = [];

  if (source.length > 0 && source.every((entry) => typeof entry === 'object' && entry !== null && 'items' in (entry as object))) {
    for (const entry of source as Array<{ id?: unknown; title?: unknown; icon?: unknown; items?: unknown }>) {
      const title = toStringSafe(entry.title).trim();
      if (!title) continue;
      const itemsRaw = Array.isArray(entry.items) ? entry.items : [];
      cards.push({
        id: toStringSafe(entry.id).trim() || `card-${Math.random().toString(16).slice(2, 8)}`,
        title,
        icon: toStringSafe(entry.icon).trim() || undefined,
        items: itemsRaw.map((item) => ({
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
        })).filter((item) => item.text.length > 0),
      });
    }
  } else if (source.length > 0) {
    // Legacy array format: [{ id, text, category, checked }]
    const grouped = new Map<string, Array<{ id: string; text: string; checked: boolean }>>();
    for (const legacy of source as LegacyPackingItem[]) {
      const text = toStringSafe(legacy?.text).trim();
      if (!text) continue;
      const category = toStringSafe(legacy?.category, 'Misc / Other').trim() || 'Misc / Other';
      const current = grouped.get(category) ?? [];
      current.push({
        id: toStringSafe(legacy?.id).trim() || `item-${Math.random().toString(16).slice(2, 8)}`,
        text,
        checked: Boolean(legacy?.checked),
      });
      grouped.set(category, current);
    }
    for (const [title, items] of grouped.entries()) {
      cards.push({
        id: `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(16).slice(2, 6)}`,
        title,
        items,
      });
    }
  }

  const byTitle = new Map(cards.map((card) => [card.title.toLowerCase(), card]));
  for (const title of DEFAULT_PACKING_CARD_TITLES) {
    if (!byTitle.has(title.toLowerCase())) {
      cards.push({
        id: `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        items: [],
      });
    }
  }

  return cards;
}

export async function GET() {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();

    const [tripRows] = await pool.execute<TripRow[]>(
      `SELECT id, city, country, start_date, end_date, status, cover_image, planned_budget, spent_budget, reflection, gallery_json, places_json
       FROM travel_trips
       WHERE user_id = ?
       ORDER BY start_date DESC, created_at DESC`,
      [userId],
    );

    const [dreamRows] = await pool.execute<DreamRow[]>(
      `SELECT id, city, country, image, budget_estimate, trip_type, why_text, vibe, savings_goal, saved_amount
       FROM travel_dreams
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId],
    );

    const [plannerRows] = await pool.execute<PlannerRow[]>(
      `SELECT trip_id, itinerary_json, packing_json, budget_json
       FROM travel_planners
       WHERE user_id = ?`,
      [userId],
    );

    for (const row of tripRows) {
      const originalCover = row.cover_image;
      const originalGallery = parseStringArray(row.gallery_json);
      try {
        const persistedCover = await persistTravelImage(originalCover, 'trips');
        const persistedGallery = await persistTravelImages(originalGallery, 'trips/gallery');

        row.cover_image = persistedCover;
        row.gallery_json = JSON.stringify(persistedGallery);

        if (persistedCover !== originalCover || JSON.stringify(originalGallery) !== row.gallery_json) {
          await pool.execute(
            `UPDATE travel_trips
             SET cover_image = ?, gallery_json = ?
             WHERE id = ? AND user_id = ?`,
            [row.cover_image, row.gallery_json, row.id, userId],
          );
        }
      } catch {
        row.cover_image = '';
        row.gallery_json = '[]';
      }
    }

    for (const row of dreamRows) {
      const originalImage = row.image;
      try {
        const persistedImage = await persistTravelImage(originalImage, 'dreams');
        row.image = persistedImage;

        if (persistedImage !== originalImage) {
          await pool.execute(
            `UPDATE travel_dreams
             SET image = ?
             WHERE id = ? AND user_id = ?`,
            [row.image, row.id, userId],
          );
        }
      } catch {
        row.image = '';
      }
    }

    const trips = tripRows.map((row) => ({
      startDateNormalized: normalizeYmd(row.start_date),
      endDateNormalized: normalizeYmd(row.end_date),
      row,
    })).map(({ startDateNormalized, endDateNormalized, row }) => ({
      id: String(row.id),
      city: row.city,
      country: row.country,
      startDate: startDateNormalized,
      endDate: endDateNormalized,
      duration_days: computeDurationDays(startDateNormalized, endDateNormalized),
      status: row.status,
      coverImage: isDataImageUrl(row.cover_image) ? '' : sanitizeImageUrl(row.cover_image),
      plannedBudget: Number(row.planned_budget ?? 0),
      spentBudget: Number(row.spent_budget ?? 0),
      reflection: row.reflection ?? '',
      gallery: sanitizeImageList(parseStringArray(row.gallery_json)),
      placesVisited: parseStringArray(row.places_json),
    }));

    const dreamDestinations = dreamRows.map((row) => ({
      id: String(row.id),
      city: row.city,
      country: row.country,
      image: isDataImageUrl(row.image) ? '' : sanitizeImageUrl(row.image),
      budgetEstimate: Number(row.budget_estimate ?? 0),
      tripType: row.trip_type,
      why: row.why_text ?? '',
      vibe: row.vibe,
      savingsGoal: Number(row.savings_goal ?? 0),
      savedAmount: Number(row.saved_amount ?? 0),
    }));

    const plannerData: Record<string, unknown> = {};
    for (const row of plannerRows) {
      const parsedPacking = parseObject(row.packing_json, [] as unknown[]);
      plannerData[String(row.trip_id)] = {
        itinerary: parseObject(row.itinerary_json, [] as unknown[]),
        packingCards: toPackingCards(parsedPacking),
        budget: parseObject(row.budget_json, {
          flights: 0,
          hotel: 0,
          activities: 0,
          food: 0,
          misc: 0,
        }),
      };
    }

    return NextResponse.json({ trips, dreamDestinations, plannerData });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load travel data.' }, { status: 500 });
  }
}
