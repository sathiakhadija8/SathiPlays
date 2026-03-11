import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';
import { addPointsSafe } from '../../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = { plant_id?: unknown };

type PlantRow = RowDataPacket & {
  id: number;
  name: string;
  watering_frequency_days: number;
  last_watered_at: string | null;
  next_watering_at: string;
};

function parsePlantId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function nowSqlDateTime(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

async function pickPlant(plantId: number | null) {
  if (plantId) {
    const [rows] = await pool.execute<PlantRow[]>(
      `SELECT id, name, watering_frequency_days, last_watered_at, next_watering_at
       FROM plants
       WHERE id = ?
       LIMIT 1`,
      [plantId],
    );
    return rows[0] ?? null;
  }

  const [rows] = await pool.execute<PlantRow[]>(
    `SELECT id, name, watering_frequency_days, last_watered_at, next_watering_at
     FROM plants
     ORDER BY id ASC
     LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const requestedId = parsePlantId(body.plant_id);

    let plant = await pickPlant(requestedId);

    if (requestedId && !plant) {
      return NextResponse.json({ ok: false, message: 'Plant not found.' }, { status: 404 });
    }

    if (!requestedId && !plant) {
      const now = nowSqlDateTime();
      const [insertResult] = await pool.execute<ResultSetHeader>(
        `INSERT INTO plants (name, watering_frequency_days, last_watered_at, next_watering_at)
         VALUES (?, ?, ?, DATE_ADD(?, INTERVAL 2 DAY))`,
        ['Balcony Plant', 2, now, now],
      );
      plant = await pickPlant(insertResult.insertId);
    }

    if (!plant) {
      return NextResponse.json({ ok: false, message: 'Unable to create plant.' }, { status: 500 });
    }

    const now = nowSqlDateTime();
    const dueNow =
      !plant.next_watering_at || new Date(String(plant.next_watering_at).replace(' ', 'T')).getTime() <= Date.now();

    await pool.execute<ResultSetHeader>(
      `INSERT INTO plant_logs (plant_id, watered_at)
       VALUES (?, ?)`,
      [plant.id, now],
    );

    await pool.execute<ResultSetHeader>(
      `UPDATE plants
       SET last_watered_at = ?,
           next_watering_at = DATE_ADD(?, INTERVAL watering_frequency_days DAY)
       WHERE id = ?`,
      [now, now, plant.id],
    );

    const [updatedRows] = await pool.execute<PlantRow[]>(
      `SELECT id, name, watering_frequency_days, last_watered_at, next_watering_at
       FROM plants
       WHERE id = ?
       LIMIT 1`,
      [plant.id],
    );

    const pointsAwarded = dueNow ? 8 : 5;
    await addPointsSafe({
      domain: 'home',
      sourceType: 'plant_water',
      sourceId: plant.id,
      points: pointsAwarded,
      reason: dueNow ? 'Plant watered on time' : 'Plant watered early',
    });

    return NextResponse.json({
      ok: true,
      watered_at: now,
      plant: updatedRows[0] ?? plant,
      due: false,
      watered_today: true,
      points_awarded: pointsAwarded,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to water plant.' }, { status: 500 });
  }
}
