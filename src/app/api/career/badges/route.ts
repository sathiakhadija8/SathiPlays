import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type BadgeRow = RowDataPacket & {
  id: number;
  title: string;
  issuer: string | null;
  completed_date: string | null;
  badge_icon_key: string | null;
  badge_color: string | null;
  badge_image_path: string | null;
  created_at: string;
};

type Body = {
  title?: unknown;
  issuer?: unknown;
  completed_date?: unknown;
  badge_icon_key?: unknown;
  badge_color?: unknown;
  badge_image_path?: unknown;
};

export async function GET() {
  try {
    const [rows] = await pool.execute<BadgeRow[]>(
      `SELECT id, title, issuer, completed_date, badge_icon_key, badge_color, badge_image_path, created_at
       FROM certification_badges
       ORDER BY created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load badges.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const issuer = typeof body.issuer === 'string' ? body.issuer.trim() : '';
    const completedDate = typeof body.completed_date === 'string' ? body.completed_date.trim() : '';
    const badgeIconKey = typeof body.badge_icon_key === 'string' ? body.badge_icon_key.trim() : '';
    const badgeColor = typeof body.badge_color === 'string' ? body.badge_color.trim() : '';
    const badgeImagePath = typeof body.badge_image_path === 'string' ? body.badge_image_path.trim() : '';

    if (!title || title.length > 160) {
      return NextResponse.json({ ok: false, message: 'title is required (<=160).' }, { status: 400 });
    }
    if (completedDate && !DATE_RE.test(completedDate)) {
      return NextResponse.json({ ok: false, message: 'completed_date must be YYYY-MM-DD.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO certification_badges (title, issuer, completed_date, badge_icon_key, badge_color, badge_image_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title,
        issuer || null,
        completedDate || null,
        badgeIconKey || null,
        badgeColor || null,
        badgeImagePath || null,
      ],
    );

    return NextResponse.json({ ok: true, insertedId: result.insertId });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to create badge.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    await pool.execute(`DELETE FROM certification_badges WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete badge.' }, { status: 500 });
  }
}
