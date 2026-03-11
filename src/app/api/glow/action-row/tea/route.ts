import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureGlowActionRowSchema, getActionRowToday } from '../../../../../lib/glow-action-row';

export const dynamic = 'force-dynamic';

type Body = {
  tea_type_id?: unknown;
  tea_name?: unknown;
  logged_at?: unknown;
  notes?: unknown;
};

type TeaTypeRow = RowDataPacket & {
  id: number;
  name: string;
  is_active: number;
};

function parseDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');
  const second = String(parsed.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export async function POST(request: Request) {
  try {
    await ensureGlowActionRowSchema();
    const body = (await request.json().catch(() => ({}))) as Body;
    let teaTypeId = Number(body.tea_type_id);

    if (!Number.isInteger(teaTypeId) || teaTypeId <= 0) {
      const teaName = typeof body.tea_name === 'string' ? body.tea_name.trim() : '';
      if (!teaName) {
        return NextResponse.json({ ok: false, message: 'tea_type_id or tea_name is required.' }, { status: 400 });
      }

      const [existingRows] = await pool.execute<TeaTypeRow[]>(
        `SELECT id, name, is_active FROM tea_types WHERE LOWER(name) = LOWER(?) LIMIT 1`,
        [teaName],
      );

      if (existingRows[0]) {
        teaTypeId = existingRows[0].id;
        if (Number(existingRows[0].is_active) !== 1) {
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

    const loggedAt = parseDateTime(body.logged_at) ?? parseDateTime(new Date().toISOString())!;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    await pool.execute<ResultSetHeader>(
      `INSERT INTO tea_logs (tea_type_id, logged_at, notes) VALUES (?, ?, ?)`,
      [teaTypeId, loggedAt, notes ? notes.slice(0, 2000) : null],
    );

    return NextResponse.json({ ok: true, ...(await getActionRowToday()) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save tea log.' }, { status: 500 });
  }
}
