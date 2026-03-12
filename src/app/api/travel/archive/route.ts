import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureTravelTables, getTravelUserId, parseStringArray } from '../../../../lib/travel-server';
import { isDataImageUrl, persistTravelImage } from '../../../../lib/travel-image-storage';
import { normalizeYmd } from '../../../../lib/travel-dates';

export const runtime = 'nodejs';

type TripRow = RowDataPacket & {
  id: number;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  status: 'dream' | 'upcoming' | 'completed';
  cover_image: string;
};

type MemoryAggRow = RowDataPacket & {
  trip_id: number;
  avg_rating: number | null;
  memories_count: number;
};

type PlacesRow = RowDataPacket & {
  places_json: string;
};

export async function GET() {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();

    const [tripRows] = await pool.execute<TripRow[]>(
      `SELECT id, city, country, start_date, end_date, status, cover_image
       FROM travel_trips
       WHERE user_id = ? AND status = 'completed'
       ORDER BY start_date DESC, id DESC`,
      [userId],
    );

    for (const row of tripRows) {
      const originalCover = row.cover_image;
      try {
        const persistedCover = await persistTravelImage(originalCover, 'trips');
        row.cover_image = persistedCover;
        if (persistedCover !== originalCover) {
          await pool.execute(
            `UPDATE travel_trips
             SET cover_image = ?
             WHERE id = ? AND user_id = ?`,
            [row.cover_image, row.id, userId],
          );
        }
      } catch {
        row.cover_image = '';
      }
    }

    const [memoryRows] = await pool.execute<MemoryAggRow[]>(
      `SELECT trip_id, AVG(rating) AS avg_rating, COUNT(*) AS memories_count
       FROM travel_trip_memories
       WHERE user_id = ?
       GROUP BY trip_id`,
      [userId],
    );
    const memoryByTrip = new Map<number, MemoryAggRow>(memoryRows.map((row) => [row.trip_id, row]));

    const [placesRows] = await pool.execute<PlacesRow[]>(
      `SELECT places_json FROM travel_trips WHERE user_id = ? AND status = 'completed'`,
      [userId],
    );

    const yearMap = new Map<string, number>();
    const placeCount = new Map<string, number>();
    for (const row of tripRows) {
      const startDate = normalizeYmd(row.start_date);
      const year = startDate.slice(0, 4) || 'Unknown';
      yearMap.set(year, (yearMap.get(year) ?? 0) + 1);
    }
    for (const row of placesRows) {
      for (const place of parseStringArray(row.places_json)) {
        placeCount.set(place, (placeCount.get(place) ?? 0) + 1);
      }
    }

    const scrapbookCards = tripRows.map((row) => {
      const memory = memoryByTrip.get(row.id);
      const startDate = normalizeYmd(row.start_date);
      const endDate = normalizeYmd(row.end_date);
      return {
        tripId: String(row.id),
        title: `${row.city}, ${row.country}`,
        dateRange: `${startDate || 'Unknown'} - ${endDate || 'Unknown'}`,
        coverImage: isDataImageUrl(row.cover_image) ? '' : row.cover_image,
        memoryCount: Number(memory?.memories_count ?? 0),
        averageRating: memory?.avg_rating ? Number(memory.avg_rating) : null,
      };
    });

    const yearlyRecap = [...yearMap.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, totalTrips]) => ({ year, totalTrips }));

    const favoritePlaces = [...placeCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([place, visits]) => ({ place, visits }));

    return NextResponse.json({
      yearlyRecap,
      favoritePlaces,
      scrapbookCards,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to build travel archive.' }, { status: 500 });
  }
}
