import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../../../lib/db';
import { ensureDrinksSchema, type DrinkCategory, type TimeOfDay } from '../../../../../../../lib/glow-drinks';

export const dynamic = 'force-dynamic';

type Body = {
  category?: unknown;
  name?: unknown;
  recipe?: unknown;
  icon_image_path?: unknown;
  time_of_day?: unknown;
  is_active?: unknown;
  seed_types?: unknown;
};

type SeedRow = RowDataPacket & {
  id: number;
  name: string;
  recipe: string | null;
  time_of_day: TimeOfDay;
  is_active: number;
  seed_types: unknown;
};

type BeautyRow = RowDataPacket & {
  id: number;
  name: string;
  recipe: string | null;
  icon_image_path: string | null;
  time_of_day: TimeOfDay;
  is_active: number;
};

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCategory(value: unknown): DrinkCategory {
  if (value === 'beauty_drink') return 'beauty_drink';
  return 'seed_water';
}

function normalizeTimeOfDay(value: unknown): TimeOfDay {
  if (value === 'midday' || value === 'evening' || value === 'night') return value;
  return 'morning';
}

function parseSeedTypes(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return parseSeedTypes(JSON.parse(value));
    } catch {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return [] as string[];
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDrinksSchema();
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const category = normalizeCategory(body.category);

    if (category === 'seed_water') {
      const [rows] = await pool.execute<SeedRow[]>(
        `
          SELECT id, name, recipe, time_of_day, is_active, JSON_EXTRACT(seed_types, '$') AS seed_types
          FROM seed_waters
          WHERE id = ?
          LIMIT 1
        `,
        [id],
      );
      const current = rows[0];
      if (!current) return NextResponse.json({ ok: false, message: 'Seed water not found.' }, { status: 404 });

      const name = body.name === undefined ? current.name : asString(body.name);
      if (!name) return NextResponse.json({ ok: false, message: 'name is required.' }, { status: 400 });

      const recipe = body.recipe === undefined ? current.recipe : asString(body.recipe) || null;
      const timeOfDay = body.time_of_day === undefined ? normalizeTimeOfDay(current.time_of_day) : normalizeTimeOfDay(body.time_of_day);
      const isActive = body.is_active === undefined ? Number(current.is_active) : Number(body.is_active) ? 1 : 0;
      const seedTypes = body.seed_types === undefined ? parseSeedTypes(current.seed_types) : parseSeedTypes(body.seed_types);

      await pool.execute<ResultSetHeader>(
        `
          UPDATE seed_waters
          SET name = ?, seed_types = ?, recipe = ?, time_of_day = ?, is_active = ?
          WHERE id = ?
        `,
        [name.slice(0, 160), JSON.stringify(seedTypes), recipe, timeOfDay, isActive, id],
      );

      return NextResponse.json({ ok: true });
    }

    const [rows] = await pool.execute<BeautyRow[]>(
      `
        SELECT
          CAST(legacy_id AS SIGNED) AS id,
          title AS name,
          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.recipe')) AS recipe,
          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.icon_image_path')) AS icon_image_path,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.time_of_day')), 'morning') AS time_of_day,
          is_active
        FROM sp_catalog_items
        WHERE domain_key = 'glow'
          AND item_type = 'beauty_drink_recipe'
          AND legacy_id = ?
        LIMIT 1
      `,
      [id],
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ ok: false, message: 'Beauty drink not found.' }, { status: 404 });

    const name = body.name === undefined ? current.name : asString(body.name);
    if (!name) return NextResponse.json({ ok: false, message: 'name is required.' }, { status: 400 });

    const recipe = body.recipe === undefined ? current.recipe : asString(body.recipe) || null;
    const iconImagePath = body.icon_image_path === undefined ? current.icon_image_path : asString(body.icon_image_path) || null;
    const timeOfDay = body.time_of_day === undefined ? normalizeTimeOfDay(current.time_of_day) : normalizeTimeOfDay(body.time_of_day);
    const isActive = body.is_active === undefined ? Number(current.is_active) : Number(body.is_active) ? 1 : 0;

    await pool.execute<ResultSetHeader>(
      `
        UPDATE beauty_drink_recipes
        SET name = ?, recipe = ?, icon_image_path = ?, time_of_day = ?, is_active = ?
        WHERE id = ?
      `,
      [name.slice(0, 160), recipe, iconImagePath, timeOfDay, isActive, id],
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update drink.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDrinksSchema();
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const category = normalizeCategory(searchParams.get('category'));

    const [result] = await pool.execute<ResultSetHeader>(
      category === 'seed_water' ? `DELETE FROM seed_waters WHERE id = ?` : `DELETE FROM beauty_drink_recipes WHERE id = ?`,
      [id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Drink not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete drink.' }, { status: 500 });
  }
}
