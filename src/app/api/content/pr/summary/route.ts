import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

type SummaryRow = RowDataPacket & {
  pending_count: number;
  paid_count: number;
  total_pr_revenue: string | number;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [rows] = await pool.execute<SummaryRow[]>(
      `
      SELECT
        SUM(CASE WHEN pd.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN pd.status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
        COALESCE(SUM(CASE WHEN pd.status = 'paid' THEN pd.payment_amount ELSE 0 END), 0) AS total_pr_revenue
      FROM pr_deliverables pd
      INNER JOIN pr_brands pb ON pb.id = pd.pr_brand_id
      WHERE pb.brand_id = ?
      `,
      [brandId],
    );

    return NextResponse.json({
      pending_count: Number(rows[0]?.pending_count ?? 0),
      paid_count: Number(rows[0]?.paid_count ?? 0),
      total_pr_revenue: Number(rows[0]?.total_pr_revenue ?? 0),
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load PR summary.' }, { status: 500 });
  }
}
