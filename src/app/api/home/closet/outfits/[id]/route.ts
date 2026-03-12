import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';
import { isOutfitSlotType } from '../../../../../../lib/home-closet';

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

function parseId(idRaw: string) {
  const id = Number(idRaw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function asString(value: unknown, maxLength: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t.slice(0, maxLength) : null;
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const connection = await pool.getConnection();
  try {
    const outfitId = parseId(context.params.id);
    if (!outfitId) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const body = (await request.json()) as Body;
    const name = asString(body.name, 160);
    const vibe = asString(body.vibe, 120);
    const occasion = asString(body.occasion, 120);
    const season = asString(body.season, 60);
    const notes = asString(body.notes, 4000);
    const previewImagePath = asString(body.preview_image_path, 400);

    if (name === null) {
      return NextResponse.json({ ok: false, message: 'name is invalid.' }, { status: 400 });
    }

    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE closet_outfits
       SET name = COALESCE(?, name),
           vibe = COALESCE(?, vibe),
           occasion = COALESCE(?, occasion),
           season = COALESCE(?, season),
           notes = COALESCE(?, notes),
           preview_image_path = COALESCE(?, preview_image_path)
       WHERE id = ?`,
      [name ?? null, vibe ?? null, occasion ?? null, season ?? null, notes ?? null, previewImagePath ?? null, outfitId],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: 'Outfit not found.' }, { status: 404 });
    }

    if (Array.isArray(body.items)) {
      const rawItems = body.items as OutfitItemInput[];
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

      await connection.execute(`DELETE FROM closet_outfit_items WHERE outfit_id = ?`, [outfitId]);
      if (normalizedItems.length > 0) {
        const valuesSql = normalizedItems.map(() => '(?, ?, ?, ?)').join(',');
        const params: Array<number | string> = [];
        for (const item of normalizedItems) {
          params.push(outfitId, item.closetItemId, item.slotType, item.sortOrder);
        }
        await connection.execute(
          `INSERT INTO closet_outfit_items (outfit_id, closet_item_id, slot_type, sort_order)
           VALUES ${valuesSql}`,
          params,
        );
      }
    }

    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch {
    await connection.rollback().catch(() => undefined);
    return NextResponse.json({ ok: false, message: 'Unable to update outfit.' }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    const outfitId = parseId(context.params.id);
    if (!outfitId) return NextResponse.json({ ok: false, message: 'id is invalid.' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM closet_outfits WHERE id = ?`, [outfitId]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Outfit not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete outfit.' }, { status: 500 });
  }
}
