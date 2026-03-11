import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type DraftRow = RowDataPacket & {
  id: number;
  brand_id: number;
  title: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'pinterest' | 'facebook';
  category: string | null;
  description: string | null;
  status: 'filmed' | 'edited' | 'scheduled';
  script_id: number | null;
  monetized: number;
  thumbnail_path: string | null;
  filmed_at: string | null;
  scheduled_at: string | null;
  created_at: string;
};

const DRAFT_STATUSES = ['filmed', 'edited', 'scheduled'] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const statusParam = (searchParams.get('status') ?? 'all').toLowerCase();
    const where: string[] = ['brand_id = ?'];
    const params: Array<string | number> = [brandId];

    if (statusParam === 'all') {
      where.push(`status IN (${DRAFT_STATUSES.map(() => '?').join(',')})`);
      params.push(...DRAFT_STATUSES);
    } else if (DRAFT_STATUSES.includes(statusParam as (typeof DRAFT_STATUSES)[number])) {
      where.push('status = ?');
      params.push(statusParam);
    } else {
      return NextResponse.json({ ok: false, message: 'Invalid drafts status filter.' }, { status: 400 });
    }

    const [rows] = await pool.execute<DraftRow[]>(
      `
      SELECT
        id, brand_id, title, platform, category, description, status,
        script_id, monetized, thumbnail_path, filmed_at, scheduled_at, created_at
      FROM content_items
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(scheduled_at, filmed_at, created_at) DESC
      `,
      params,
    );

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load drafts.' }, { status: 500 });
  }
}
