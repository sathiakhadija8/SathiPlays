import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { DAILY_PRACTICE_DEFAULT_ICON } from '../../../../../lib/career-constants';
import { ensureDailyPracticeIconColumns } from '../../../../../lib/career-schema';

export const dynamic = 'force-dynamic';

const ICON_TYPES = new Set(['preset', 'upload']);

type ItemRow = RowDataPacket & {
  id: number;
  key_name: string | null;
  name: string;
  display_name: string | null;
  icon_type: 'preset' | 'upload';
  preset_icon: string | null;
  uploaded_icon_url: string | null;
  is_active: number;
  created_at: string;
};

type CreateBody = {
  title?: unknown;
  icon_type?: unknown;
  preset_icon?: unknown;
  uploaded_icon_url?: unknown;
  key_name?: unknown;
};

type UpdateBody = {
  id?: unknown;
  title?: unknown;
  icon_type?: unknown;
  preset_icon?: unknown;
  uploaded_icon_url?: unknown;
};

function toSlugKey(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function parseIconType(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return ICON_TYPES.has(normalized) ? (normalized as 'preset' | 'upload') : null;
}

function parsePresetIcon(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 120) return null;
  return normalized;
}

function parseUploadedIconUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 400) return null;
  return normalized;
}

export async function GET() {
  try {
    await ensureDailyPracticeIconColumns();

    const [rows] = await pool.execute<ItemRow[]>(
      `SELECT
          CAST(legacy_id AS SIGNED) AS id,
          key_name,
          title AS name,
          subtitle AS display_name,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.icon_type')), 'preset') AS icon_type,
          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.preset_icon')) AS preset_icon,
          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.uploaded_icon_url')) AS uploaded_icon_url,
          is_active,
          created_at
       FROM sp_catalog_items
       WHERE domain_key = 'career'
         AND item_type = 'daily_practice_item'
         AND is_active = 1
         AND legacy_id IS NOT NULL
       ORDER BY created_at ASC, id ASC`,
    );

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        key_name: row.key_name,
        title: row.display_name ?? row.name,
        icon_type: row.icon_type,
        preset_icon: row.preset_icon ?? DAILY_PRACTICE_DEFAULT_ICON,
        uploaded_icon_url: row.uploaded_icon_url ?? null,
        is_active: row.is_active,
        created_at: row.created_at,
      })),
    );
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load daily practice items.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDailyPracticeIconColumns();
    const body = (await request.json()) as CreateBody;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const iconType = parseIconType(body.icon_type) ?? 'preset';
    const presetIcon = parsePresetIcon(body.preset_icon);
    const uploadedIconUrl = parseUploadedIconUrl(body.uploaded_icon_url);
    const explicitKey = typeof body.key_name === 'string' ? body.key_name.trim() : '';
    const keyName = explicitKey ? toSlugKey(explicitKey) : toSlugKey(title);

    if (!title || title.length > 120) {
      return NextResponse.json({ ok: false, message: 'title is required (<=120).' }, { status: 400 });
    }
    if (iconType === 'preset' && !presetIcon) {
      return NextResponse.json({ ok: false, message: 'preset_icon is required for preset icon type.' }, { status: 400 });
    }
    if (iconType === 'upload' && !uploadedIconUrl) {
      return NextResponse.json({ ok: false, message: 'uploaded_icon_url is required for upload icon type.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO daily_practice_items (key_name, name, display_name, icon_type, preset_icon, uploaded_icon_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        keyName || null,
        title,
        title,
        iconType,
        iconType === 'preset' ? presetIcon : null,
        iconType === 'upload' ? uploadedIconUrl : null,
      ],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create daily practice item.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureDailyPracticeIconColumns();
    const body = (await request.json()) as UpdateBody;

    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : null;
    const iconType = body.icon_type === undefined ? null : parseIconType(body.icon_type);
    const presetIcon = body.preset_icon === undefined ? null : parsePresetIcon(body.preset_icon);
    const uploadedIconUrl = body.uploaded_icon_url === undefined ? null : parseUploadedIconUrl(body.uploaded_icon_url);

    if (title !== null && (!title || title.length > 120)) {
      return NextResponse.json({ ok: false, message: 'title must be <=120.' }, { status: 400 });
    }
    if (body.icon_type !== undefined && !iconType) {
      return NextResponse.json({ ok: false, message: 'icon_type must be preset or upload.' }, { status: 400 });
    }

    const [currentRows] = await pool.execute<ItemRow[]>(
      `SELECT id, icon_type, preset_icon, uploaded_icon_url
       FROM daily_practice_items
       WHERE id = ? AND is_active = 1
       LIMIT 1`,
      [id],
    );

    const current = currentRows[0];
    if (!current) {
      return NextResponse.json({ ok: false, message: 'Daily practice item not found.' }, { status: 404 });
    }

    const nextIconType = iconType ?? current.icon_type;
    const nextPreset = body.preset_icon === undefined ? current.preset_icon : presetIcon;
    const nextUploaded = body.uploaded_icon_url === undefined ? current.uploaded_icon_url : uploadedIconUrl;

    if (nextIconType === 'preset' && !nextPreset) {
      return NextResponse.json({ ok: false, message: 'preset_icon is required for preset icon type.' }, { status: 400 });
    }
    if (nextIconType === 'upload' && !nextUploaded) {
      return NextResponse.json({ ok: false, message: 'uploaded_icon_url is required for upload icon type.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE daily_practice_items
       SET name = COALESCE(?, name),
           display_name = COALESCE(?, display_name),
           icon_type = ?,
           preset_icon = ?,
           uploaded_icon_url = ?
       WHERE id = ? AND is_active = 1`,
      [
        title,
        title,
        nextIconType,
        nextIconType === 'preset' ? nextPreset : null,
        nextIconType === 'upload' ? nextUploaded : null,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Daily practice item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to update daily practice item.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE daily_practice_items
       SET is_active = 0
       WHERE id = ? AND is_active = 1`,
      [id],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: 'Daily practice item not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete daily practice item.' }, { status: 500 });
  }
}
