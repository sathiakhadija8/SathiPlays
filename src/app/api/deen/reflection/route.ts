import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';
import { ensureDeenTables, londonTodayYmd, type ReflectionRow } from '../../../../lib/deen-server';
import { addPointsOnceSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

const QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

type Body = {
  answers?: Partial<Record<(typeof QUESTIONS)[number], string>>;
};

function hasAnyAnswer(values: Record<(typeof QUESTIONS)[number], string>) {
  return QUESTIONS.some((key) => values[key].trim().length > 0);
}

export async function GET() {
  try {
    await ensureDeenTables();
    const date = londonTodayYmd();

    const [rows] = await pool.execute<ReflectionRow[]>(
      `SELECT q1, q2, q3, q4, q5, q6 FROM deen_reflections WHERE log_date = ? LIMIT 1`,
      [date],
    );

    return NextResponse.json({
      date,
      answers: {
        q1: rows[0]?.q1 ?? '',
        q2: rows[0]?.q2 ?? '',
        q3: rows[0]?.q3 ?? '',
        q4: rows[0]?.q4 ?? '',
        q5: rows[0]?.q5 ?? '',
        q6: rows[0]?.q6 ?? '',
      },
    });
  } catch {
    return NextResponse.json({ message: 'Unable to load reflection.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDeenTables();
    const date = londonTodayYmd();
    const body = (await request.json().catch(() => ({}))) as Body;

    const [existingRows] = await pool.execute<ReflectionRow[]>(
      `SELECT q1, q2, q3, q4, q5, q6 FROM deen_reflections WHERE log_date = ? LIMIT 1`,
      [date],
    );
    const previousAnswers = {
      q1: existingRows[0]?.q1 ?? '',
      q2: existingRows[0]?.q2 ?? '',
      q3: existingRows[0]?.q3 ?? '',
      q4: existingRows[0]?.q4 ?? '',
      q5: existingRows[0]?.q5 ?? '',
      q6: existingRows[0]?.q6 ?? '',
    };
    const hadReflectionBefore = hasAnyAnswer(previousAnswers);

    const answers = QUESTIONS.reduce((acc, key) => {
      acc[key] = (body.answers?.[key] ?? '').trim().slice(0, 1200);
      return acc;
    }, {} as Record<(typeof QUESTIONS)[number], string>);

    await pool.execute(
      `
      INSERT INTO deen_reflections (log_date, q1, q2, q3, q4, q5, q6)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE q1 = VALUES(q1), q2 = VALUES(q2), q3 = VALUES(q3), q4 = VALUES(q4), q5 = VALUES(q5), q6 = VALUES(q6)
      `,
      [date, answers.q1, answers.q2, answers.q3, answers.q4, answers.q5, answers.q6],
    );

    const hasReflectionNow = hasAnyAnswer(answers);
    const pointsAwarded = hasReflectionNow && !hadReflectionBefore ? 15 : 0;
    if (pointsAwarded > 0) {
      const awarded = await addPointsOnceSafe({
        domain: 'deen',
        sourceType: `reflection_${date}`,
        sourceId: Number(date.replace(/-/g, '')),
        points: pointsAwarded,
        reason: 'Daily Deen reflection completed',
      });
      return NextResponse.json({ ok: true, points_awarded: awarded ? pointsAwarded : 0 });
    }

    return NextResponse.json({ ok: true, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ message: 'Unable to save reflection.' }, { status: 500 });
  }
}
