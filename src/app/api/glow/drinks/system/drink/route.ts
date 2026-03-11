import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';
import { ensureDrinksSchema, type DrinkCategory, type TimeOfDay } from '../../../../../../lib/glow-drinks';

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

function normalizeSeedTypes(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return normalizeSeedTypes(JSON.parse(value));
    } catch {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return [] as string[];
}

export async function POST(request: Request) {
  try {
    await ensureDrinksSchema();
    const body = (await request.json().catch(() => ({}))) as Body;

    const category = normalizeCategory(body.category);
    const name = asString(body.name);
    const recipe = asString(body.recipe) || null;
    const iconImagePath = asString(body.icon_image_path) || null;
    const timeOfDay = normalizeTimeOfDay(body.time_of_day);
    const isActive = body.is_active === undefined ? 1 : Number(body.is_active) ? 1 : 0;

    if (!name) {
      return NextResponse.json({ ok: false, message: 'name is required.' }, { status: 400 });
    }

    if (category === 'seed_water') {
      const seedTypes = normalizeSeedTypes(body.seed_types);
      const [result] = await pool.execute<ResultSetHeader>(
        `
          INSERT INTO seed_waters (name, seed_types, recipe, time_of_day, is_active)
          VALUES (?, ?, ?, ?, ?)
        `,
        [name.slice(0, 160), JSON.stringify(seedTypes), recipe, timeOfDay, isActive],
      );
      return NextResponse.json({ ok: true, insertedId: result.insertId });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `
        INSERT INTO beauty_drink_recipes (name, recipe, icon_image_path, time_of_day, is_active)
        VALUES (?, ?, ?, ?, ?)
      `,
      [name.slice(0, 160), recipe, iconImagePath, timeOfDay, isActive],
    );
    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create drink.' }, { status: 500 });
  }
}
