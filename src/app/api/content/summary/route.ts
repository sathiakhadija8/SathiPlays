import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type BrandRow = RowDataPacket & {
  id: number;
  key: 'personal' | 'business';
  name: string;
};

type CountRow = RowDataPacket & {
  status: 'idea' | 'scripted' | 'filmed' | 'edited' | 'scheduled' | 'posted';
  count: number;
};

type UpcomingRow = RowDataPacket & {
  id: number;
  title: string;
  platform: string;
  scheduled_at: string;
  status: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandIdParam = Number(searchParams.get('brand_id'));
    const brandKey = searchParams.get('brand_key');

    let brand: BrandRow | undefined;
    if (Number.isInteger(brandIdParam) && brandIdParam > 0) {
      const [rows] = await pool.execute<BrandRow[]>(
        `SELECT id, \`key\`, name FROM brands WHERE id = ? LIMIT 1`,
        [brandIdParam],
      );
      brand = rows[0];
    } else if (brandKey === 'personal' || brandKey === 'business') {
      const [rows] = await pool.execute<BrandRow[]>(
        `SELECT id, \`key\`, name FROM brands WHERE \`key\` = ? LIMIT 1`,
        [brandKey],
      );
      brand = rows[0];
    } else {
      const [rows] = await pool.execute<BrandRow[]>(
        `SELECT id, \`key\`, name FROM brands ORDER BY FIELD(\`key\`, 'personal', 'business') ASC LIMIT 1`,
      );
      brand = rows[0];
    }

    if (!brand) {
      return NextResponse.json({ ok: false, message: 'No brands configured.' }, { status: 404 });
    }

    const [countRows] = await pool.execute<CountRow[]>(
      `
      SELECT status, COUNT(*) AS count
      FROM content_items
      WHERE brand_id = ?
      GROUP BY status
      `,
      [brand.id],
    );

    const countsByStatus = {
      idea: 0,
      scripted: 0,
      filmed: 0,
      edited: 0,
      scheduled: 0,
      posted: 0,
    };
    for (const row of countRows) {
      countsByStatus[row.status] = Number(row.count ?? 0);
    }

    const [upcomingRows] = await pool.execute<UpcomingRow[]>(
      `
      SELECT id, title, platform, scheduled_at, status
      FROM content_items
      WHERE brand_id = ?
        AND scheduled_at IS NOT NULL
        AND scheduled_at >= NOW()
      ORDER BY scheduled_at ASC
      LIMIT 5
      `,
      [brand.id],
    );

    const [draftRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS drafts_count FROM content_items WHERE brand_id = ? AND status IN ('filmed','edited','scheduled')`,
      [brand.id],
    );
    const draftsCount = Number(draftRows[0]?.drafts_count ?? 0);

    const alerts: string[] = [];
    if (countsByStatus.scheduled === 0) alerts.push('No scheduled content for this brand');
    if (countsByStatus.idea > 20) alerts.push('High idea backlog — convert ideas into scripts');
    if (countsByStatus.edited > 10) alerts.push('Edited queue is high — push more to scheduled');

    return NextResponse.json({
      brand: { id: brand.id, name: brand.name, key: brand.key },
      countsByStatus,
      upcomingScheduled: upcomingRows,
      draftsCount,
      alerts,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load content summary.' }, { status: 500 });
  }
}
