import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { ensureDeenTables, isValidYmd, todayYmd } from '../../../../lib/deen-server';
import { addPointsOnceSafe } from '../../../../lib/points-helpers';

export const dynamic = 'force-dynamic';

type Body = {
  date?: string;
  note?: string;
};

type NoteRow = RowDataPacket & {
  note: string | null;
};

export async function POST(request: Request) {
  try {
    await ensureDeenTables();
    const body = (await request.json().catch(() => ({}))) as Body;

    const date = isValidYmd((body.date ?? '').trim()) ? (body.date as string) : todayYmd();
    const note = (body.note ?? '').trim().slice(0, 800);

    const [existingRows] = await pool.execute<NoteRow[]>(
      `SELECT note FROM deen_daily_notes WHERE note_date = ? LIMIT 1`,
      [date],
    );
    const hadNoteBefore = Boolean((existingRows[0]?.note ?? '').trim());

    await pool.execute(
      `
      INSERT INTO deen_daily_notes (note_date, note)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE note = VALUES(note)
      `,
      [date, note],
    );

    const hasNoteNow = note.trim().length > 0;
    const pointsAwarded = hasNoteNow && !hadNoteBefore ? 5 : 0;
    if (pointsAwarded > 0) {
      const awarded = await addPointsOnceSafe({
        domain: 'deen',
        sourceType: `deen_note_${date}`,
        sourceId: Number(date.replace(/-/g, '')),
        points: pointsAwarded,
        reason: 'Deen daily note saved',
      });
      return NextResponse.json({ ok: true, date, note, points_awarded: awarded ? pointsAwarded : 0 });
    }

    return NextResponse.json({ ok: true, date, note, points_awarded: pointsAwarded });
  } catch {
    return NextResponse.json({ message: 'Unable to save note.' }, { status: 500 });
  }
}
