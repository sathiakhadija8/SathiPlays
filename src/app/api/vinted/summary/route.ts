import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type KpiRow = RowDataPacket & {
  revenue: number | null;
  fees: number | null;
  active_listings: number | null;
  sold_count: number | null;
};

type InvestedRow = RowDataPacket & {
  bundles_cost: number | null;
  expenses_cost: number | null;
};

export async function GET() {
  try {
    const [kpiRows] = await pool.execute<KpiRow[]>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'sold' THEN sale_price ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN platform_fee ELSE 0 END), 0) AS fees,
        COALESCE(SUM(CASE WHEN status = 'listed' THEN 1 ELSE 0 END), 0) AS active_listings,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END), 0) AS sold_count
      FROM vinted_items
      `,
    );

    const [investedRows] = await pool.execute<InvestedRow[]>(
      `
      SELECT
        COALESCE((SELECT SUM(total_cost) FROM vinted_bundles WHERE status = 'delivered'), 0) AS bundles_cost,
        COALESCE((SELECT SUM(cost) FROM vinted_expenses), 0) AS expenses_cost
      `,
    );

    const revenue = Number(kpiRows[0]?.revenue ?? 0);
    const fees = Number(kpiRows[0]?.fees ?? 0);
    const activeListings = Number(kpiRows[0]?.active_listings ?? 0);
    const soldCount = Number(kpiRows[0]?.sold_count ?? 0);
    const bundlesCost = Number(investedRows[0]?.bundles_cost ?? 0);
    const expensesCost = Number(investedRows[0]?.expenses_cost ?? 0);
    const invested = bundlesCost + expensesCost;
    const roiPercentage = invested > 0 ? ((revenue - fees - invested) / invested) * 100 : 0;

    return NextResponse.json({
      revenue,
      fees,
      invested,
      net_profit: revenue - fees - invested,
      roi_percentage: roiPercentage,
      active_listings: activeListings,
      sold_count: soldCount,
    });
  } catch {
    return NextResponse.json(
      {
        revenue: 0,
        fees: 0,
        invested: 0,
        net_profit: 0,
        roi_percentage: 0,
        active_listings: 0,
        sold_count: 0,
      },
      { status: 200 },
    );
  }
}
