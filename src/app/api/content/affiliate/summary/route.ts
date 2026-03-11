import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type TotalRow = RowDataPacket & { total_amount: string | number; logs_count: number };
type TopRow = RowDataPacket & { affiliate_id: number; product_name: string; total_amount: string | number };

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [totalsRows] = await pool.execute<TotalRow[]>(
      `
      SELECT
        COALESCE(SUM(ae.amount), 0) AS total_amount,
        COUNT(ae.id) AS logs_count
      FROM affiliate_earnings ae
      INNER JOIN affiliate_links al ON al.id = ae.affiliate_id
      WHERE al.brand_id = ?
      `,
      [brandId],
    );

    const [topRows] = await pool.execute<TopRow[]>(
      `
      SELECT
        al.id AS affiliate_id,
        al.product_name,
        COALESCE(SUM(ae.amount), 0) AS total_amount
      FROM affiliate_links al
      LEFT JOIN affiliate_earnings ae ON ae.affiliate_id = al.id
      WHERE al.brand_id = ?
      GROUP BY al.id, al.product_name
      ORDER BY total_amount DESC
      LIMIT 5
      `,
      [brandId],
    );

    return NextResponse.json({
      total_amount: Number(totalsRows[0]?.total_amount ?? 0),
      logs_count: Number(totalsRows[0]?.logs_count ?? 0),
      top_earners: topRows.map((row) => ({
        affiliate_id: row.affiliate_id,
        product_name: row.product_name,
        total_amount: Number(row.total_amount ?? 0),
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load affiliate summary.' }, { status: 500 });
  }
}
