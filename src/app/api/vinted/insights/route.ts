import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type CountRow = RowDataPacket & { value: number | null };
type TopCategoryRow = RowDataPacket & { category: string | null; sold_count: number | null };
type MarginRow = RowDataPacket & { avg_margin_pct: number | null };

type AlertItem = {
  id: string;
  title: string;
  detail: string;
  priority: number;
};

export async function GET() {
  try {
    const [listedRows] = await pool.execute<CountRow[]>(
      `SELECT COALESCE(COUNT(*), 0) AS value FROM vinted_items WHERE status = 'listed'`,
    );
    const [draftRows] = await pool.execute<CountRow[]>(
      `SELECT COALESCE(COUNT(*), 0) AS value FROM vinted_items WHERE status = 'draft'`,
    );
    const [staleRows] = await pool.execute<CountRow[]>(
      `
      SELECT COALESCE(COUNT(*), 0) AS value
      FROM vinted_items
      WHERE status = 'listed'
        AND created_at < DATE_SUB(NOW(), INTERVAL 14 DAY)
      `,
    );
    const [topCategoryRows] = await pool.execute<TopCategoryRow[]>(
      `
      SELECT category, COUNT(*) AS sold_count
      FROM vinted_items
      WHERE status = 'sold'
      GROUP BY category
      ORDER BY sold_count DESC
      LIMIT 1
      `,
    );
    const [marginRows] = await pool.execute<MarginRow[]>(
      `
      SELECT AVG(((sale_price - cost_price - COALESCE(platform_fee, 0)) / cost_price) * 100) AS avg_margin_pct
      FROM vinted_items
      WHERE status = 'sold'
        AND sale_price IS NOT NULL
        AND cost_price > 0
      `,
    );
    const [packagingRows] = await pool.execute<CountRow[]>(
      `
      SELECT COALESCE(SUM(cost), 0) AS value
      FROM vinted_expenses
      WHERE type = 'packaging'
      `,
    );
    const [deliveredRows] = await pool.execute<CountRow[]>(
      `SELECT COALESCE(COUNT(*), 0) AS value FROM vinted_bundles WHERE status = 'delivered'`,
    );

    const listed = Number(listedRows[0]?.value ?? 0);
    const drafts = Number(draftRows[0]?.value ?? 0);
    const staleListed = Number(staleRows[0]?.value ?? 0);
    const topCategory = topCategoryRows[0]?.category ?? null;
    const topCategorySoldCount = Number(topCategoryRows[0]?.sold_count ?? 0);
    const avgMarginPercent = Number(marginRows[0]?.avg_margin_pct ?? 0);
    const packagingSpend = Number(packagingRows[0]?.value ?? 0);
    const deliveredBundles = Number(deliveredRows[0]?.value ?? 0);

    const alerts: AlertItem[] = [];
    if (listed < 10) {
      alerts.push({
        id: 'low-listing-stock',
        title: 'Low listing stock',
        detail: `Only ${listed} listed items live right now.`,
        priority: 100,
      });
    }
    if (staleListed > 0) {
      alerts.push({
        id: 'slow-movers',
        title: 'Slow movers detected',
        detail: `${staleListed} listed items are older than 14 days.`,
        priority: 90,
      });
    }
    if (deliveredBundles > 0) {
      alerts.push({
        id: 'delivered-bundles',
        title: 'Delivered bundles pending',
        detail: `${deliveredBundles} delivered bundle(s) waiting to be processed.`,
        priority: 80,
      });
    }

    const opsTasks: string[] = [];
    if (listed < 10) opsTasks.push(`List ${Math.max(10 - listed, 1)} items today`);
    if (drafts > 0) opsTasks.push(`Photograph ${Math.min(drafts, 15)} drafts`);
    if (staleListed > 0) opsTasks.push(`Discount ${Math.min(staleListed, 5)} slow movers`);
    if (packagingSpend <= 0) opsTasks.push('Order packaging if expenses low/none');
    if (deliveredBundles > 0) opsTasks.push(`Process delivered bundles (${deliveredBundles})`);
    if (opsTasks.length === 0) opsTasks.push('Maintain listing cadence and refresh titles');

    const prioritizedAlerts = alerts.sort((a, b) => b.priority - a.priority).slice(0, 3);

    return NextResponse.json({
      low_listing_stock: listed < 10,
      listed_count: listed,
      stale_unsold_count: staleListed,
      stale_rule: 'v1 uses created_at as listed_at proxy (listed >14 days unsold).',
      top_selling_category: topCategory,
      top_selling_category_count: topCategorySoldCount,
      average_margin_percent: Number.isFinite(avgMarginPercent) ? avgMarginPercent : 0,
      ops_tasks: opsTasks,
      alerts: prioritizedAlerts,
    });
  } catch {
    return NextResponse.json(
      {
        low_listing_stock: false,
        listed_count: 0,
        stale_unsold_count: 0,
        stale_rule: 'v1 uses created_at as listed_at proxy (listed >14 days unsold).',
        top_selling_category: null,
        top_selling_category_count: 0,
        average_margin_percent: 0,
        ops_tasks: ['List 10 items today', 'Photograph 15 drafts'],
        alerts: [],
      },
      { status: 200 },
    );
  }
}
