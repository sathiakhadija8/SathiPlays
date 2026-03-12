import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureTravelTables, getTravelUserId, parseObject } from '../../../../../lib/travel-server';
import { buildAutoItinerary, buildAutoPackingCards, type AutoOutfit } from '../../../../../lib/travel-planner-auto';

type TripRow = RowDataPacket & {
  id: number;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
};

type ExistingPlannerRow = RowDataPacket & {
  budget_json: string | null;
};

type OutfitRow = RowDataPacket & {
  outfit_id: number;
  outfit_name: string;
  piece_name: string;
};

type ForgottenRow = RowDataPacket & {
  item_text: string;
  miss_count: number;
};

type WeatherHint = {
  summary: string;
  items: string[];
};

async function weatherHintForTrip(city: string, startYmd: string, endYmd: string): Promise<WeatherHint | null> {
  try {
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      { cache: 'no-store' },
    );
    if (!geoResponse.ok) return null;
    const geoPayload = (await geoResponse.json()) as {
      results?: Array<{ latitude: number; longitude: number; name: string }>;
    };
    const first = geoPayload.results?.[0];
    if (!first) return null;

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${first.latitude}&longitude=${first.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${startYmd}&end_date=${endYmd}`,
      { cache: 'no-store' },
    );
    if (!weatherResponse.ok) return null;
    const weatherPayload = (await weatherResponse.json()) as {
      daily?: {
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
      };
    };
    const maxTemps = weatherPayload.daily?.temperature_2m_max ?? [];
    const minTemps = weatherPayload.daily?.temperature_2m_min ?? [];
    const rain = weatherPayload.daily?.precipitation_probability_max ?? [];
    if (maxTemps.length === 0 || minTemps.length === 0) return null;

    const avgMax = maxTemps.reduce((sum, value) => sum + value, 0) / maxTemps.length;
    const avgMin = minTemps.reduce((sum, value) => sum + value, 0) / minTemps.length;
    const maxRain = rain.length > 0 ? Math.max(...rain) : 0;

    const items: string[] = [];
    if (avgMin <= 8) items.push('Warm layer (coat/hoodie) x1');
    if (avgMax >= 24) items.push('Breathable tops x2');
    if (maxRain >= 45) items.push('Umbrella or rain jacket x1');
    if (avgMax >= 20) items.push('Sunglasses x1');
    items.push('Comfort walking shoes x1');

    return {
      summary: `${city}: avg ${Math.round(avgMin)}-${Math.round(avgMax)}°C, rain risk up to ${Math.round(maxRain)}%`,
      items,
    };
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

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

    const [plannerRows] = await pool.execute<ExistingPlannerRow[]>(
      `SELECT budget_json
       FROM travel_planners
       WHERE trip_id = ? AND user_id = ?
       LIMIT 1`,
      [tripId, userId],
    );
    const existingBudget = parseObject(
      plannerRows[0]?.budget_json ?? null,
      { flights: 0, hotel: 0, activities: 0, food: 0, misc: 0 },
    );

    const [outfitRows] = await pool.execute<OutfitRow[]>(
      `
      SELECT
        co.id AS outfit_id,
        co.name AS outfit_name,
        ci.name AS piece_name
      FROM closet_outfits co
      JOIN closet_outfit_items coi ON coi.outfit_id = co.id
      JOIN closet_items ci ON ci.id = coi.closet_item_id
      WHERE ci.is_archived = 0 AND ci.state = 'in_closet'
      ORDER BY co.updated_at DESC, co.id DESC, coi.sort_order ASC
      LIMIT 120
      `,
    );

    const outfitMap = new Map<number, AutoOutfit>();
    for (const row of outfitRows) {
      if (!outfitMap.has(row.outfit_id)) {
        outfitMap.set(row.outfit_id, {
          outfitName: row.outfit_name,
          pieces: [],
        });
      }
      outfitMap.get(row.outfit_id)?.pieces.push(row.piece_name);
    }
    const outfits = [...outfitMap.values()].slice(0, 4);

    const [forgottenRows] = await pool.execute<ForgottenRow[]>(
      `SELECT item_text, miss_count
       FROM travel_forgotten_items
       WHERE user_id = ?
       ORDER BY miss_count DESC, last_seen_at DESC
       LIMIT 8`,
      [userId],
    );
    const forgottenItems = forgottenRows.map((row) => row.item_text);

    const startYmd = String(trip.start_date).slice(0, 10);
    const endYmd = String(trip.end_date).slice(0, 10);
    const itinerary = buildAutoItinerary(startYmd, endYmd, trip.city);
    const packingCards = buildAutoPackingCards({
      startYmd,
      endYmd,
      outfits,
      city: trip.city,
    });
    const weatherHint = await weatherHintForTrip(trip.city, startYmd, endYmd);
    if (weatherHint) {
      packingCards.push({
        id: 'card-weather-smart-pack',
        title: 'Weather Smart Pack',
        icon: '☁️',
        items: [weatherHint.summary, ...weatherHint.items].map((entry, index) => ({
          id: `weather-${index}`,
          text: entry,
          checked: false,
        })),
      });
    }
    if (forgottenItems.length > 0) {
      packingCards.push({
        id: 'card-remember-this-time',
        title: 'Remember This Time',
        icon: '🧠',
        items: forgottenItems.map((entry, index) => ({
          id: `forgotten-${index}-${entry.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          text: entry,
          checked: false,
        })),
      });
    }

    return NextResponse.json({
      ok: true,
      planner: {
        itinerary,
        packingCards,
        budget: existingBudget,
      },
      meta: {
        outfits_used: outfits.length,
        forgotten_items_used: forgottenItems.length,
        weather_used: Boolean(weatherHint),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to auto-build planner.' }, { status: 500 });
  }
}
