import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import pool from '../../../../../../lib/db';
import {
  dayKeyFromDate,
  ensureGlowActionRowSchema,
  normalizePlanDay,
  normalizeWorkoutType,
  type GymPlanDay,
  type GymWorkoutType,
} from '../../../../../../lib/glow-action-row';
import { localTodayYMD } from '../../../../../../lib/glow-schedule';

export const dynamic = 'force-dynamic';

type PlanRow = RowDataPacket & {
  id: number;
  day_of_week: GymPlanDay;
  workout_type: GymWorkoutType;
  is_active: number;
};

type DoneRow = RowDataPacket & {
  day_of_week: GymPlanDay;
};

type Body = {
  plans?: Array<{
    day_of_week?: unknown;
    workout_type?: unknown;
    is_active?: unknown;
  }>;
};

const ORDER: GymPlanDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export async function GET() {
  try {
    await ensureGlowActionRowSchema();

    const today = localTodayYMD();
    const [plansRes, doneRes] = await Promise.all([
      pool.execute<PlanRow[]>(
        `SELECT id, day_of_week, workout_type, is_active FROM gym_weekly_plan ORDER BY FIELD(day_of_week,'mon','tue','wed','thu','fri','sat','sun') ASC`,
      ),
      pool.execute<DoneRow[]>(
        `
          SELECT DISTINCT
            CASE DAYOFWEEK(date)
              WHEN 1 THEN 'sun'
              WHEN 2 THEN 'mon'
              WHEN 3 THEN 'tue'
              WHEN 4 THEN 'wed'
              WHEN 5 THEN 'thu'
              WHEN 6 THEN 'fri'
              WHEN 7 THEN 'sat'
            END AS day_of_week
          FROM gym_logs
          WHERE YEARWEEK(date, 1) = YEARWEEK(?, 1)
        `,
        [today],
      ),
    ]);

    const plans = plansRes[0];
    const doneSet = new Set(doneRes[0].map((row) => row.day_of_week));
    const todayDay = dayKeyFromDate(new Date(`${today}T00:00:00`));

    return NextResponse.json({
      week_of: today,
      today_day: todayDay,
      plans: ORDER.map((day) => {
        const found = plans.find((plan) => plan.day_of_week === day);
        return {
          id: found?.id ?? null,
          day_of_week: day,
          workout_type: found?.workout_type ?? 'rest',
          is_active: found ? (Number(found.is_active) === 1 ? 1 : 0) : 1,
          completed_this_week: doneSet.has(day),
        };
      }),
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load weekly gym plan.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureGlowActionRowSchema();
    const body = (await request.json().catch(() => ({}))) as Body;
    const plans = Array.isArray(body.plans) ? body.plans : [];
    if (plans.length === 0) {
      return NextResponse.json({ ok: false, message: 'plans is required.' }, { status: 400 });
    }

    for (const plan of plans) {
      const day = normalizePlanDay(plan.day_of_week);
      const workoutType = normalizeWorkoutType(plan.workout_type);
      const isActive = plan.is_active === undefined ? 1 : Number(plan.is_active) ? 1 : 0;

      await pool.execute<ResultSetHeader>(
        `
          INSERT INTO gym_weekly_plan (day_of_week, workout_type, is_active)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            workout_type = VALUES(workout_type),
            is_active = VALUES(is_active)
        `,
        [day, workoutType, isActive],
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to save weekly gym plan.' }, { status: 500 });
  }
}
