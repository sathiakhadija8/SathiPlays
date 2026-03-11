import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureDrinksSchema, localTodayYMD } from '../../../../../lib/glow-drinks';

export const dynamic = 'force-dynamic';

type TeaTypeRow = RowDataPacket & {
  id: number;
  name: string;
  is_active: number;
};

type TeaLogRow = RowDataPacket & {
  id: number;
  tea_type_id: number;
  tea_name: string;
  logged_at: string;
  moods: unknown;
  notes: string | null;
};

type Body = {
  tea_type_id?: unknown;
  tea_name?: unknown;
  logged_at?: unknown;
  moods?: unknown;
  notes?: unknown;
};

function parseMoods(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return parseMoods(JSON.parse(value));
    } catch {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return [] as string[];
}

function parseOptionalDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().replace('T', ' ');
  const asDate = new Date(normalized.replace(' ', 'T'));
  if (Number.isNaN(asDate.getTime())) return null;
  const year = asDate.getFullYear();
  const month = String(asDate.getMonth() + 1).padStart(2, '0');
  const day = String(asDate.getDate()).padStart(2, '0');
  const hour = String(asDate.getHours()).padStart(2, '0');
  const minute = String(asDate.getMinutes()).padStart(2, '0');
  const second = String(asDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

async function fetchPayloadForToday() {
  const today = localTodayYMD();

  const [teaTypes] = await pool.execute<TeaTypeRow[]>(
    `SELECT id, name, is_active FROM tea_types WHERE is_active = 1 ORDER BY name ASC, id ASC`,
  );

  const [todayLogs] = await pool.execute<TeaLogRow[]>(
    `
      SELECT
        l.id,
        l.tea_type_id,
        t.name AS tea_name,
        DATE_FORMAT(l.logged_at, '%Y-%m-%d %H:%i:%s') AS logged_at,
        JSON_EXTRACT(l.moods, '$') AS moods,
        l.notes
      FROM tea_logs l
      INNER JOIN tea_types t ON t.id = l.tea_type_id
      WHERE DATE(l.logged_at) = ?
      ORDER BY l.logged_at DESC, l.id DESC
    `,
    [today],
  );

  return {
    date: today,
    tea_types: teaTypes.map((row) => ({ id: row.id, name: row.name, is_active: Number(row.is_active) === 1 ? 1 : 0 })),
    today_logs: todayLogs.map((row) => ({
      id: row.id,
      tea_type_id: row.tea_type_id,
      tea_name: row.tea_name,
      logged_at: row.logged_at,
      moods: parseMoods(row.moods),
      notes: row.notes,
    })),
  };
}

export async function GET() {
  try {
    await ensureDrinksSchema();
    return NextResponse.json(await fetchPayloadForToday());
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load tea check-in.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDrinksSchema();
    const body = (await request.json().catch(() => ({}))) as Body;

    let teaTypeId = Number(body.tea_type_id);

    if (!Number.isInteger(teaTypeId) || teaTypeId <= 0) {
      const teaName = typeof body.tea_name === 'string' ? body.tea_name.trim() : '';
      if (!teaName) {
        return NextResponse.json({ ok: false, message: 'tea_type_id is required.' }, { status: 400 });
      }

      const [existing] = await pool.execute<TeaTypeRow[]>(
        `SELECT id, name, is_active FROM tea_types WHERE LOWER(name) = LOWER(?) LIMIT 1`,
        [teaName],
      );

      if (existing[0]) {
        teaTypeId = existing[0].id;
        if (Number(existing[0].is_active) !== 1) {
          await pool.execute(`UPDATE tea_types SET is_active = 1 WHERE id = ?`, [teaTypeId]);
        }
      } else {
        const [insert] = await pool.execute<ResultSetHeader>(
          `INSERT INTO tea_types (name, is_active) VALUES (?, 1)`,
          [teaName.slice(0, 120)],
        );
        teaTypeId = insert.insertId;
      }
    }

    const loggedAt = parseOptionalDateTime(body.logged_at) ?? parseOptionalDateTime(new Date().toISOString())!;
    const moods = parseMoods(body.moods);
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    await pool.execute(
      `INSERT INTO tea_logs (tea_type_id, logged_at, moods, notes) VALUES (?, ?, ?, ?)`,
      [teaTypeId, loggedAt, moods.length > 0 ? JSON.stringify(moods) : null, notes ? notes.slice(0, 2000) : null],
    );

    return NextResponse.json({ ok: true, ...(await fetchPayloadForToday()) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save tea log.' }, { status: 500 });
  }
}
