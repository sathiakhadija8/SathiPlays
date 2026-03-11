import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../lib/db';
import { computeLevel } from '../../../lib/level-helpers';

export const dynamic = 'force-dynamic';

type TotalRow = RowDataPacket & { total_points: number };
type DomainRow = RowDataPacket & { domain: string; points: number };

export async function GET() {
  try {
    const [totalRows] = await pool.execute<TotalRow[]>(
      `SELECT COALESCE(SUM(points), 0) AS total_points FROM points_logs`,
    );
    const totalPoints = Number(totalRows[0]?.total_points ?? 0);

    const [breakdownRows] = await pool.execute<DomainRow[]>(
      `SELECT domain, COALESCE(SUM(points), 0) AS points
       FROM points_logs
       GROUP BY domain`,
    );

    const domainBreakdown: Record<string, number> = {};
    for (const row of breakdownRows) {
      domainBreakdown[row.domain] = Number(row.points ?? 0);
    }

    const computed = computeLevel(totalPoints);

    return NextResponse.json({
      total_points: computed.total_points,
      level: computed.level,
      progress_ratio: computed.progress_ratio,
      points_to_next_level: computed.points_to_next_level,
      domain_breakdown: domainBreakdown,
      current_level_number: computed.level.number,
      current_level_label: computed.level.label,
      level_min_points: computed.level.min_points,
      level_max_points: computed.level.max_points,
    });
  } catch {
    const fallback = computeLevel(0);
    return NextResponse.json({
      total_points: 0,
      level: fallback.level,
      progress_ratio: fallback.progress_ratio,
      points_to_next_level: fallback.points_to_next_level,
      domain_breakdown: {},
      current_level_number: fallback.level.number,
      current_level_label: fallback.level.label,
      level_min_points: fallback.level.min_points,
      level_max_points: fallback.level.max_points,
    });
  }
}
