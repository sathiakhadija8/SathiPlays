import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { CLOSET_STATES, isClosetState, type ClosetState } from '../../../../lib/home-closet';

export const dynamic = 'force-dynamic';

type ClosetItemRow = RowDataPacket & {
  id: number;
  name: string;
  size: string | null;
  category: string | null;
  subcategory: string | null;
  color: string | null;
  brand: string | null;
  season: string | null;
  occasion: string | null;
  image_path: string | null;
  notes: string | null;
  state: ClosetState;
  is_favorite: number;
  is_archived: number;
  wear_count: number;
  last_worn_at: string | null;
  created_at: string;
  updated_at: string;
};

type ClosetCountRow = RowDataPacket & {
  state: ClosetState;
  total_count: number;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('include_archived') === '1';
    const state = isClosetState(searchParams.get('state')) ? searchParams.get('state') : null;
    const query = (searchParams.get('q') ?? '').trim().toLowerCase();
    const season = (searchParams.get('season') ?? '').trim();
    const occasion = (searchParams.get('occasion') ?? '').trim();

    const whereParts: string[] = [];
    const params: Array<string | number> = [];
    if (!includeArchived) whereParts.push('is_archived = 0');
    if (state) {
      whereParts.push('state = ?');
      params.push(state);
    }
    if (season) {
      whereParts.push('season = ?');
      params.push(season);
    }
    if (occasion) {
      whereParts.push('occasion = ?');
      params.push(occasion);
    }
    if (query) {
      whereParts.push('(LOWER(name) LIKE ? OR LOWER(COALESCE(category, \"\")) LIKE ? OR LOWER(COALESCE(brand, \"\")) LIKE ?)');
      const q = `%${query}%`;
      params.push(q, q, q);
    }
    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [items] = await pool.execute<ClosetItemRow[]>(
      `SELECT id, name, size, category, subcategory, color, brand, season, occasion, image_path, notes, state,
              is_favorite, is_archived, wear_count, last_worn_at, created_at, updated_at
       FROM closet_items
       ${whereSql}
       ORDER BY updated_at DESC, id DESC`,
      params,
    );

    const [countsRows] = await pool.execute<ClosetCountRow[]>(
      `SELECT state, COUNT(*) AS total_count
       FROM closet_items
       GROUP BY state`,
    );

    const counts = CLOSET_STATES.reduce<Record<ClosetState, number>>((acc, state) => {
      acc[state] = 0;
      return acc;
    }, {} as Record<ClosetState, number>);

    for (const row of countsRows) {
      counts[row.state] = Number(row.total_count ?? 0);
    }

    return NextResponse.json({ items, counts });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load closet data.' }, { status: 500 });
  }
}
