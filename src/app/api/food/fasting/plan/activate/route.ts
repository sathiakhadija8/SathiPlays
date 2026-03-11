import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../../lib/db';

export const dynamic = 'force-dynamic';

type Body = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  start_time?: unknown;
  end_time?: unknown;
};

function validType(value: unknown): value is 'ramadan_dry' | 'window' | 'omad' | 'custom' {
  return value === 'ramadan_dry' || value === 'window' || value === 'omad' || value === 'custom';
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = (await request.json()) as Body;
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(`UPDATE fasting_plans SET is_active = 0`);

    const id = Number(body.id);
    let activeId = 0;
    if (Number.isInteger(id) && id > 0) {
      await connection.execute<ResultSetHeader>(`UPDATE fasting_plans SET is_active = 1 WHERE id = ?`, [id]);
      activeId = id;
    } else {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const type = validType(body.type) ? body.type : null;
      const startTime = typeof body.start_time === 'string' ? body.start_time.trim() : null;
      const endTime = typeof body.end_time === 'string' ? body.end_time.trim() : null;
      if (!name || !type) {
        await connection.rollback();
        return NextResponse.json({ ok: false, message: 'Either existing id or new plan {name,type} is required.' }, { status: 400 });
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO fasting_plans (name, type, start_time, end_time, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [name, type, startTime || null, endTime || null],
      );
      activeId = result.insertId;
    }
    await connection.commit();
    return NextResponse.json({ ok: true, active_plan_id: activeId });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to activate fasting plan.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
