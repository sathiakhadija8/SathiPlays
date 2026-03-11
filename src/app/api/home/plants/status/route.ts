import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type PlantRow = RowDataPacket & {
  id: number;
  name: string;
  watering_frequency_days: number;
  last_watered_at: string | null;
  next_watering_at: string;
};

function nowSqlDateTime(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

async function ensurePlant() {
  const [rows] = await pool.execute<PlantRow[]>(
    `SELECT id, name, watering_frequency_days, last_watered_at, next_watering_at
     FROM plants
     ORDER BY id ASC
     LIMIT 1`,
  );

  if (rows.length > 0) return rows[0];

  const now = nowSqlDateTime();
  const [insertResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO plants (name, watering_frequency_days, last_watered_at, next_watering_at)
     VALUES (?, ?, ?, DATE_ADD(?, INTERVAL 2 DAY))`,
    ['Balcony Plant', 2, now, now],
  );

  const [nextRows] = await pool.execute<PlantRow[]>(
    `SELECT id, name, watering_frequency_days, last_watered_at, next_watering_at
     FROM plants
     WHERE id = ?
     LIMIT 1`,
    [insertResult.insertId],
  );

  return nextRows[0];
}

export async function GET() {
  try {
    const plant = await ensurePlant();

    const [dueRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         CASE
           WHEN NOW() >= ? AND ( ? IS NULL OR DATE(?) <> CURDATE() ) THEN 1
           ELSE 0
         END AS is_due,
         CASE WHEN ? IS NOT NULL AND DATE(?) = CURDATE() THEN 1 ELSE 0 END AS watered_today`,
      [plant.next_watering_at, plant.last_watered_at, plant.last_watered_at, plant.last_watered_at, plant.last_watered_at],
    );

    const row = dueRows[0] as RowDataPacket | undefined;
    const isDue = Number(row?.is_due ?? 0) === 1;
    const wateredToday = Number(row?.watered_today ?? 0) === 1;

    return NextResponse.json({
      plant,
      due: isDue,
      watered_today: wateredToday,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load plant status.' }, { status: 500 });
  }
}
