import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';
import {
  DEEN_DHIKR_TYPES,
  DEEN_SALAH_ORDER,
  ensureDeenTables,
  type DhikrCountRow,
  type LearningRow,
  type QuranRow,
  type SalahRow,
  londonTodayYmd,
  toNumber,
} from '../../../../lib/deen-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDeenTables();
    const today = londonTodayYmd();

    const [learningRows] = await pool.execute<LearningRow[]>(
      `SELECT COALESCE(SUM(actual_minutes), 0) AS total_minutes FROM deen_learning_sessions WHERE log_date = ?`,
      [today],
    );

    const [dhikrRows] = await pool.execute<DhikrCountRow[]>(
      `
      SELECT dhikr_type, COUNT(*) AS count
      FROM deen_dhikr_logs
      WHERE log_date = ?
      GROUP BY dhikr_type
      `,
      [today],
    );

    const [salahRows] = await pool.execute<SalahRow[]>(
      `SELECT prayer_key FROM deen_salah_logs WHERE log_date = ?`,
      [today],
    );

    const [quranRows] = await pool.execute<QuranRow[]>(
      `SELECT pages_read, daily_goal, mushaf_version FROM deen_quran_progress WHERE log_date = ? LIMIT 1`,
      [today],
    );

    const doneSet = new Set(salahRows.map((row) => row.prayer_key));
    const nextSalah = DEEN_SALAH_ORDER.find((prayer) => !doneSet.has(prayer)) ?? null;

    const dhikrCounts = Object.fromEntries(
      DEEN_DHIKR_TYPES.map((type) => {
        const row = dhikrRows.find((item) => item.dhikr_type === type);
        return [type, toNumber(row?.count ?? 0)];
      }),
    );

    const quran = {
      pages_read: toNumber(quranRows[0]?.pages_read ?? 0),
      daily_goal: Math.max(1, toNumber(quranRows[0]?.daily_goal ?? 5)),
      mushaf_version: quranRows[0]?.mushaf_version ?? 'Standard',
    };

    return NextResponse.json({
      date: today,
      learning_minutes_today: toNumber(learningRows[0]?.total_minutes ?? 0),
      dhikr_counts: dhikrCounts,
      salah_done: DEEN_SALAH_ORDER.map((prayer) => ({ key: prayer, done: doneSet.has(prayer) })),
      next_salah: nextSalah,
      salah_completed: nextSalah === null,
      quran,
    });
  } catch {
    return NextResponse.json({ message: 'Unable to load Deen dashboard.' }, { status: 500 });
  }
}
