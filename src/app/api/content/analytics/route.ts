import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';

export const dynamic = 'force-dynamic';

type PostedMetricRow = RowDataPacket & {
  content_item_id: number;
  title: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'pinterest' | 'facebook';
  category: string | null;
  posted_at: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  revenue: string | number;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = Number(searchParams.get('brand_id'));
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return NextResponse.json({ ok: false, message: 'brand_id is required.' }, { status: 400 });
    }

    const [rows] = await pool.execute<PostedMetricRow[]>(
      `
      SELECT
        ci.id AS content_item_id,
        ci.title,
        ci.platform,
        ci.category,
        ci.posted_at,
        COALESCE(cm.views, 0) AS views,
        COALESCE(cm.likes, 0) AS likes,
        COALESCE(cm.comments, 0) AS comments,
        COALESCE(cm.shares, 0) AS shares,
        COALESCE(cm.saves, 0) AS saves,
        COALESCE(cm.revenue, 0) AS revenue
      FROM content_items ci
      LEFT JOIN content_metrics cm ON cm.content_item_id = ci.id
      WHERE ci.brand_id = ?
        AND ci.status = 'posted'
      ORDER BY COALESCE(ci.posted_at, ci.created_at) DESC
      `,
      [brandId],
    );

    const items = rows.map((row) => {
      const views = Number(row.views ?? 0);
      const likes = Number(row.likes ?? 0);
      const comments = Number(row.comments ?? 0);
      const shares = Number(row.shares ?? 0);
      const saves = Number(row.saves ?? 0);
      const revenue = Number(row.revenue ?? 0);
      const engagementRaw = likes + comments + shares + saves;
      const engagementRate = views > 0 ? engagementRaw / views : 0;
      return {
        content_item_id: row.content_item_id,
        title: row.title,
        platform: row.platform,
        category: row.category,
        posted_at: row.posted_at,
        views,
        likes,
        comments,
        shares,
        saves,
        revenue,
        engagement_rate: engagementRate,
      };
    });

    const totalPosts = items.length;
    const totalViews = items.reduce((sum, item) => sum + item.views, 0);
    const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);

    const platformMap = new Map<string, number>();
    const categoryMap = new Map<string, { sum: number; count: number }>();

    for (const item of items) {
      platformMap.set(item.platform, (platformMap.get(item.platform) ?? 0) + item.views);
      const key = item.category || 'Uncategorized';
      const current = categoryMap.get(key) ?? { sum: 0, count: 0 };
      categoryMap.set(key, { sum: current.sum + item.engagement_rate, count: current.count + 1 });
    }

    let bestPlatform = null as null | { platform: string; views: number };
    for (const [platform, views] of platformMap.entries()) {
      if (!bestPlatform || views > bestPlatform.views) {
        bestPlatform = { platform, views };
      }
    }

    let bestCategory = null as null | { category: string; avg_engagement: number };
    for (const [category, value] of categoryMap.entries()) {
      const avg = value.count ? value.sum / value.count : 0;
      if (!bestCategory || avg > bestCategory.avg_engagement) {
        bestCategory = { category, avg_engagement: avg };
      }
    }

    return NextResponse.json({
      items,
      summary: {
        total_posts_posted: totalPosts,
        total_views: totalViews,
        total_revenue: totalRevenue,
        best_platform: bestPlatform,
        best_category: bestCategory,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load analytics.' }, { status: 500 });
  }
}
