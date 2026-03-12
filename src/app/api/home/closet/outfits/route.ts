import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { isOutfitSlotType } from '../../../../../lib/home-closet';

export const dynamic = 'force-dynamic';

type OutfitItemInput = {
  closet_item_id?: unknown;
  slot_type?: unknown;
  sort_order?: unknown;
};

type Body = {
  name?: unknown;
  vibe?: unknown;
  occasion?: unknown;
  season?: unknown;
  notes?: unknown;
  preview_image_path?: unknown;
  items?: unknown;
};

type OutfitRow = RowDataPacket & {
  id: number;
  name: string;
  vibe: string | null;
  occasion: string | null;
  season: string | null;
  notes: string | null;
  preview_image_path: string | null;
  created_at: string;
  updated_at: string;
};

type OutfitItemRow = RowDataPacket & {
  id: number;
  outfit_id: number;
  closet_item_id: number;
  slot_type: string;
  sort_order: number;
  name: string;
  image_path: string | null;
};

function asString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t.slice(0, maxLength) : null;
}

export async function GET() {
  try {
    const [outfits] = await pool.execute<OutfitRow[]>(
      `SELECT id, name, vibe, occasion, season, notes, preview_image_path, created_at, updated_at
       FROM closet_outfits
       ORDER BY updated_at DESC, id DESC`,
    );

    const [items] = await pool.execute<OutfitItemRow[]>(
      `SELECT oi.id, oi.outfit_id, oi.closet_item_id, oi.slot_type, oi.sort_order, ci.name, ci.image_path
       FROM closet_outfit_items oi
       INNER JOIN closet_items ci ON ci.id = oi.closet_item_id
       ORDER BY oi.outfit_id DESC, oi.sort_order ASC, oi.id ASC`,
    );

    const byOutfit = new Map<number, OutfitItemRow[]>();
    for (const item of items) {
      const list = byOutfit.get(item.outfit_id) ?? [];
      list.push(item);
      byOutfit.set(item.outfit_id, list);
    }

    return NextResponse.json(
      outfits.map((outfit) => ({
        ...outfit,
        items: byOutfit.get(outfit.id) ?? [],
      })),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load outfits.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    const name = asString(body.name, 160);
    const vibe = asString(body.vibe, 120);
    const occasion = asString(body.occasion, 120);
    const season = asString(body.season, 60);
    const notes = asString(body.notes, 4000);
    const previewImagePath = asString(body.preview_image_path, 400);
    const rawItems = Array.isArray(body.items) ? (body.items as OutfitItemInput[]) : [];

    if (!name) {
      return NextResponse.json({ ok: false, message: 'name is required.' }, { status: 400 });
    }

    const normalizedItems = rawItems
      .map((item, index) => {
        const closetItemId = Number(item.closet_item_id);
        const slotType = item.slot_type;
        const sortOrder = Number.isInteger(Number(item.sort_order)) ? Number(item.sort_order) : index;
        if (!Number.isInteger(closetItemId) || closetItemId <= 0) return null;
        if (!isOutfitSlotType(slotType)) return null;
        return { closetItemId, slotType, sortOrder };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    await connection.beginTransaction();

    const [outfitResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO closet_outfits (name, vibe, occasion, season, notes, preview_image_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, vibe, occasion, season, notes, previewImagePath],
    );

    if (normalizedItems.length > 0) {
      const valuesSql = normalizedItems.map(() => '(?, ?, ?, ?)').join(',');
      const params: Array<number | string> = [];
      for (const item of normalizedItems) {
        params.push(Number(outfitResult.insertId), item.closetItemId, item.slotType, item.sortOrder);
      }
      await connection.execute(
        `INSERT INTO closet_outfit_items (outfit_id, closet_item_id, slot_type, sort_order)
         VALUES ${valuesSql}`,
        params,
      );
    }

    await connection.commit();
    return NextResponse.json({ ok: true, insertedId: outfitResult.insertId });
  } catch {
    await connection.rollback().catch(() => undefined);
    return NextResponse.json({ ok: false, message: 'Unable to create outfit.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
