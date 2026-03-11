import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../lib/db';
import { BLEEDING_TYPES, CYCLE_SYMPTOM_SET } from '../../../../lib/cycle-constants';
import { addPointsSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  logged_for_date?: unknown;
  symptoms?: unknown;
  bleeding_type?: unknown;
  birth_control_taken?: unknown;
  note?: unknown;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    const loggedForDateRaw = body.logged_for_date;
    if (loggedForDateRaw != null && (typeof loggedForDateRaw !== 'string' || !DATE_RE.test(loggedForDateRaw))) {
      return NextResponse.json({ ok: false, message: 'logged_for_date must be YYYY-MM-DD.' }, { status: 400 });
    }

    const symptomsRaw = body.symptoms;
    let symptoms: string[] = [];
    if (symptomsRaw != null) {
      if (!Array.isArray(symptomsRaw) || symptomsRaw.some((item) => typeof item !== 'string')) {
        return NextResponse.json({ ok: false, message: 'symptoms must be an array of strings.' }, { status: 400 });
      }
      symptoms = symptomsRaw as string[];
      if (symptoms.some((item) => !CYCLE_SYMPTOM_SET.has(item))) {
        return NextResponse.json({ ok: false, message: 'symptoms contains unsupported values.' }, { status: 400 });
      }
    }

    const bleedingTypeRaw = body.bleeding_type;
    if (
      bleedingTypeRaw != null &&
      (typeof bleedingTypeRaw !== 'string' ||
        !BLEEDING_TYPES.includes(bleedingTypeRaw as (typeof BLEEDING_TYPES)[number]))
    ) {
      return NextResponse.json({ ok: false, message: 'bleeding_type is invalid.' }, { status: 400 });
    }
    const bleedingType =
      typeof bleedingTypeRaw === 'string' ? (bleedingTypeRaw as (typeof BLEEDING_TYPES)[number]) : 'none';

    const birthControlTaken = body.birth_control_taken === true;

    const noteRaw = body.note;
    const note = typeof noteRaw === 'string' ? noteRaw.trim() : null;
    if (note && note.length > 200) {
      return NextResponse.json({ ok: false, message: 'note must be 200 chars or less.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO cycle_logs (
        logged_for_date,
        symptoms,
        bleeding_type,
        birth_control_taken,
        note
      ) VALUES (COALESCE(?, CURDATE()), ?, ?, ?, ?)`,
      [
        typeof loggedForDateRaw === 'string' ? loggedForDateRaw : null,
        JSON.stringify(symptoms),
        bleedingType,
        birthControlTaken ? 1 : 0,
        note && note.length ? note : null,
      ],
    );

    const pointsAwarded = Math.min(14, 8 + symptoms.length);
    await addPointsSafe({
      domain: 'cycle',
      sourceType: 'cycle_log',
      sourceId: result.insertId || null,
      points: pointsAwarded,
      reason: 'Cycle log saved',
    });

    return NextResponse.json({ ok: true, insertedId: result.insertId, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save cycle log right now.' }, { status: 500 });
  }
}
