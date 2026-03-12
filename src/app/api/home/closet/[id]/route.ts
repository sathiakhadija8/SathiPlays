import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';

type Body = {
  name?: unknown;
  category?: unknown;
  subcategory?: unknown;
  size?: unknown;
  color?: unknown;
  brand?: unknown;
  season?: unknown;
  occasion?: unknown;
  image_path?: unknown;
  notes?: unknown;
  is_favorite?: unknown;
  is_archived?: unknown;
  wear_count?: unknown;
  last_worn_at?: unknown;
};

function parseId(idRaw: string) {
  const id = Number(idRaw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function asOptionalString(value: unknown, maxLength: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function asOptionalBool(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === 1 || value === '1' || value === 'true') return 1;
  if (value === 0 || value === '0' || value === 'false') return 0;
  return null;
}

function asOptionalInt(value: unknown) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const id = parseId(context.params.id);
    if (!id) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const body = (await request.json()) as Body;

    const name = asOptionalString(body.name, 160);
    const category = asOptionalString(body.category, 120);
    const subcategory = asOptionalString(body.subcategory, 120);
    const size = asOptionalString(body.size, 40);
    const color = asOptionalString(body.color, 60);
    const brand = asOptionalString(body.brand, 120);
    const season = asOptionalString(body.season, 60);
    const occasion = asOptionalString(body.occasion, 120);
    const imagePath = asOptionalString(body.image_path, 400);
    const notes = asOptionalString(body.notes, 4000);
    const isFavorite = asOptionalBool(body.is_favorite);
    const isArchived = asOptionalBool(body.is_archived);
    const wearCount = asOptionalInt(body.wear_count);
    const lastWornAtRaw = asOptionalString(body.last_worn_at, 40);
    const lastWornAt = lastWornAtRaw && /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(lastWornAtRaw)
      ? lastWornAtRaw.replace('T', ' ')
      : lastWornAtRaw === null
        ? null
        : undefined;

    if (name === null) return NextResponse.json({ ok: false, message: 'name must be a string.' }, { status: 400 });
    if (isFavorite === null) return NextResponse.json({ ok: false, message: 'is_favorite is invalid.' }, { status: 400 });
    if (isArchived === null) return NextResponse.json({ ok: false, message: 'is_archived is invalid.' }, { status: 400 });
    if (wearCount === null) return NextResponse.json({ ok: false, message: 'wear_count is invalid.' }, { status: 400 });
    if (lastWornAtRaw !== undefined && lastWornAt === undefined) {
      return NextResponse.json({ ok: false, message: 'last_worn_at must be YYYY-MM-DD or datetime.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE closet_items
       SET name = COALESCE(?, name),
           category = COALESCE(?, category),
           subcategory = COALESCE(?, subcategory),
           size = COALESCE(?, size),
           color = COALESCE(?, color),
           brand = COALESCE(?, brand),
           season = COALESCE(?, season),
           occasion = COALESCE(?, occasion),
           image_path = COALESCE(?, image_path),
           notes = COALESCE(?, notes),
           is_favorite = COALESCE(?, is_favorite),
           is_archived = COALESCE(?, is_archived),
           wear_count = COALESCE(?, wear_count),
           last_worn_at = COALESCE(?, last_worn_at)
       WHERE id = ?`,
      [
        name ?? null,
        category ?? null,
        subcategory ?? null,
        size ?? null,
        color ?? null,
        brand ?? null,
        season ?? null,
        occasion ?? null,
        imagePath ?? null,
        notes ?? null,
        isFavorite ?? null,
        isArchived ?? null,
        wearCount ?? null,
        lastWornAt ?? null,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Closet item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update closet item.' }, { status: 500 });
  }
}
