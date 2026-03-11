import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import pool from '../../../../lib/db';
import { CAREER_DOMAIN, DAILY_PRACTICE_DEFAULT_ICON, dailyPracticeGuardKey } from '../../../../lib/career-constants';
import { applyCareerInactivityPenalties, todayYMD } from '../../../../lib/career-helpers';
import { ensureDailyPracticeIconColumns, ensureStudySessionsTable, ensureSubjectsCoverColumn } from '../../../../lib/career-schema';

export const dynamic = 'force-dynamic';

type SubjectRow = RowDataPacket & {
  id: number;
  name: string;
  color: string;
  icon_key: string;
  cover_image_path: string | null;
};

type DailyPracticeItemRow = RowDataPacket & {
  id: number;
  key_name: string | null;
  display_name: string | null;
  name: string;
  icon_type: 'preset' | 'upload';
  preset_icon: string | null;
  uploaded_icon_url: string | null;
  is_active: number;
};

type DailyPracticeLogRow = RowDataPacket & {
  id: number;
  item_id: number;
  log_date: string;
  created_at: string;
};

type DailyPracticeStreakRow = RowDataPacket & {
  item_id: number;
  log_date: string;
};

type GuardRow = RowDataPacket & {
  guard_key: string;
  last_activity_at: string | null;
};

type RoadmapRow = RowDataPacket & {
  id: number;
  title: string;
  created_at: string;
};

type RoadmapTaskRow = RowDataPacket & {
  id: number;
  roadmap_id: number;
  text: string;
  is_done: number;
  done_at: string | null;
  order_index: number;
};

type StudyStatsRow = RowDataPacket & {
  total_minutes: number;
  sessions_count: number;
};

type PointsRow = RowDataPacket & {
  id: number;
  source_type: string;
  points: number;
  reason: string;
  awarded_at: string;
};

function addDaysYMD(value: string, days: number): string {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function computeCurrentStreak(logDates: string[], today: string): number {
  const dateSet = new Set(logDates.map((value) => String(value).slice(0, 10)));
  if (!dateSet.has(today)) return 0;

  let streak = 0;
  let cursor = today;
  while (dateSet.has(cursor)) {
    streak += 1;
    cursor = addDaysYMD(cursor, -1);
  }
  return streak;
}

export async function GET() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureSubjectsCoverColumn();
    await ensureDailyPracticeIconColumns();
    await ensureStudySessionsTable();
    await applyCareerInactivityPenalties(connection);

    const today = todayYMD();

    const [subjects] = await connection.execute<SubjectRow[]>(
      `SELECT
          CAST(legacy_id AS SIGNED) AS id,
          title AS name,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.color')), '#4B5563') AS color,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.icon_key')), '📘') AS icon_key,
          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.cover_image_path')) AS cover_image_path
       FROM sp_catalog_items
       WHERE domain_key = 'career'
         AND item_type = 'subject'
         AND is_active = 1
         AND legacy_id IS NOT NULL
       ORDER BY created_at DESC`,
    );

    const [dailyPracticeItems] = await connection.execute<DailyPracticeItemRow[]>(
      `SELECT
          CAST(legacy_id AS SIGNED) AS id,
          key_name,
          subtitle AS display_name,
          title AS name,
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.icon_type')), 'preset') AS icon_type,
          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.preset_icon')) AS preset_icon,
          JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.uploaded_icon_url')) AS uploaded_icon_url,
          is_active
       FROM sp_catalog_items
       WHERE domain_key = 'career'
         AND item_type = 'daily_practice_item'
         AND is_active = 1
         AND legacy_id IS NOT NULL
       ORDER BY created_at ASC, id ASC`,
    );

    const [dailyLogs] = await connection.execute<DailyPracticeLogRow[]>(
      `SELECT id, item_id, log_date, created_at
       FROM daily_practice_logs
       WHERE log_date = ?`,
      [today],
    );

    let streakLogs: DailyPracticeStreakRow[] = [];
    if (dailyPracticeItems.length > 0) {
      const placeholders = dailyPracticeItems.map(() => '?').join(', ');
      const [rows] = await connection.execute<DailyPracticeStreakRow[]>(
        `SELECT item_id, log_date
         FROM daily_practice_logs
         WHERE item_id IN (${placeholders})
           AND log_date <= ?`,
        [...dailyPracticeItems.map((item) => item.id), today],
      );
      streakLogs = rows;
    }

    const [guardRows] = await connection.execute<GuardRow[]>(
      `SELECT guard_key, last_activity_at
       FROM inactivity_guards
       WHERE domain = ?`,
      ['career'],
    );

    const [pomodoroTotalRows] = await connection.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(actual_minutes), 0) AS total_minutes
       FROM pomodoro_sessions
       WHERE DATE(started_at) = ?`,
      [today],
    );

    const [roadmaps] = await connection.execute<RoadmapRow[]>(
      `SELECT id, title, created_at
       FROM roadmaps
       ORDER BY created_at DESC`,
    );

    const [roadmapTasks] = await connection.execute<RoadmapTaskRow[]>(
      `SELECT id, roadmap_id, text, is_done, done_at, order_index
       FROM roadmap_tasks
       ORDER BY roadmap_id DESC, order_index ASC, id ASC`,
    );

    const [last7Rows] = await connection.execute<StudyStatsRow[]>(
      `SELECT
          COALESCE(SUM(duration_minutes), 0) AS total_minutes,
          COUNT(*) AS sessions_count
       FROM study_sessions
       WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         AND date <= CURDATE()`,
    );

    const [last30Rows] = await connection.execute<StudyStatsRow[]>(
      `SELECT
          COALESCE(SUM(duration_minutes), 0) AS total_minutes,
          COUNT(*) AS sessions_count
       FROM study_sessions
       WHERE date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
         AND date <= CURDATE()`,
    );

    const [yearRows] = await connection.execute<StudyStatsRow[]>(
      `SELECT
          COALESCE(SUM(duration_minutes), 0) AS total_minutes,
          COUNT(*) AS sessions_count
       FROM study_sessions
       WHERE YEAR(date) = YEAR(CURDATE())`,
    );

    const [recentPoints] = await connection.execute<PointsRow[]>(
      `SELECT id, source_type, points, reason, awarded_at
       FROM points_logs
       WHERE domain = ?
       ORDER BY awarded_at DESC
       LIMIT 10`,
      [CAREER_DOMAIN],
    );

    await connection.commit();

    const tasksByRoadmap = new Map<number, RoadmapTaskRow[]>();
    for (const task of roadmapTasks) {
      const list = tasksByRoadmap.get(task.roadmap_id) ?? [];
      list.push(task);
      tasksByRoadmap.set(task.roadmap_id, list);
    }

    const roadmapsPayload = roadmaps.map((roadmap) => {
      const tasks = tasksByRoadmap.get(roadmap.id) ?? [];
      const completedCount = tasks.filter((task) => task.is_done === 1).length;
      return {
        ...roadmap,
        tasks,
        completed_count: completedCount,
        total_count: tasks.length,
      };
    });

    const last7 = last7Rows[0] ?? { total_minutes: 0, sessions_count: 0 };
    const last30 = last30Rows[0] ?? { total_minutes: 0, sessions_count: 0 };
    const thisYear = yearRows[0] ?? { total_minutes: 0, sessions_count: 0 };

    const checkedSet = new Set(dailyLogs.map((row) => row.item_id));
    const guardMap = new Map(guardRows.map((row) => [row.guard_key, row.last_activity_at]));
    const streakMap = new Map<number, string[]>();
    for (const row of streakLogs) {
      const list = streakMap.get(row.item_id) ?? [];
      list.push(String(row.log_date).slice(0, 10));
      streakMap.set(row.item_id, list);
    }

    const dailyPracticeStatuses = dailyPracticeItems.map((item) => {
      const guardKey = dailyPracticeGuardKey(item.id);
      const lastActivityRaw = guardMap.get(guardKey) ?? null;

      let remainingHours = 24;
      if (lastActivityRaw) {
        const lastActivity = new Date(String(lastActivityRaw).replace(' ', 'T'));
        if (!Number.isNaN(lastActivity.getTime())) {
          const diffMs = Date.now() - lastActivity.getTime();
          remainingHours = Math.max(0, Math.ceil((24 * 60 * 60 * 1000 - diffMs) / (60 * 60 * 1000)));
        }
      }

      return {
        item_id: item.id,
        key_name: item.key_name ?? `item_${item.id}`,
        display_name: item.display_name ?? item.name,
        icon_type: item.icon_type ?? 'preset',
        preset_icon: item.preset_icon ?? DAILY_PRACTICE_DEFAULT_ICON,
        uploaded_icon_url: item.uploaded_icon_url ?? null,
        checked_in_today: checkedSet.has(item.id),
        current_streak_days: checkedSet.has(item.id) ? computeCurrentStreak(streakMap.get(item.id) ?? [], today) : 0,
        remaining_hours_to_penalty: remainingHours,
      };
    });

    return NextResponse.json({
      subjects,
      today_pomodoro_total_minutes: Number(pomodoroTotalRows[0]?.total_minutes ?? 0),
      daily_practice_statuses: dailyPracticeStatuses,
      roadmaps: roadmapsPayload,
      study_stats: {
        last_7_days: {
          total_minutes: Number(last7.total_minutes ?? 0),
          sessions_count: Number(last7.sessions_count ?? 0),
        },
        last_30_days: {
          total_minutes: Number(last30.total_minutes ?? 0),
          sessions_count: Number(last30.sessions_count ?? 0),
        },
        this_year: {
          total_minutes: Number(thisYear.total_minutes ?? 0),
          sessions_count: Number(thisYear.sessions_count ?? 0),
        },
      },
      recent_points_logs: recentPoints,
    });
  } catch {
    await connection.rollback();
    return NextResponse.json({ ok: false, message: 'Unable to load career summary.' }, { status: 500 });
  } finally {
    connection.release();
  }
}
