import { NextResponse } from 'next/server';
import { type ResultSetHeader } from 'mysql2';
import pool from '../../../../../lib/db';
import { ensureTravelTables, getTravelUserId } from '../../../../../lib/travel-server';
import { persistTravelImage, TravelImagePersistError } from '../../../../../lib/travel-image-storage';

export const runtime = 'nodejs';

type Body = {
  city?: unknown;
  country?: unknown;
  image?: unknown;
  budgetEstimate?: unknown;
  tripType?: unknown;
  why?: unknown;
  vibe?: unknown;
  savingsGoal?: unknown;
  savedAmount?: unknown;
};

function isTripType(value: string): value is 'UK' | 'Overseas' {
  return value === 'UK' || value === 'Overseas';
}

function isVibe(value: string): value is 'Solo' | 'Friends' | 'Romantic' | 'Cultural' {
  return value === 'Solo' || value === 'Friends' || value === 'Romantic' || value === 'Cultural';
}

function parseNonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const city = String(body.city ?? '').trim();
    const country = String(body.country ?? '').trim();
    const imageRaw = String(body.image ?? '').trim();
    const tripType = String(body.tripType ?? 'Overseas').trim();
    const vibe = String(body.vibe ?? 'Solo').trim();
    const why = String(body.why ?? '').trim();
    const budgetEstimate = parseNonNegativeNumber(body.budgetEstimate ?? 0);
    const savingsGoal = parseNonNegativeNumber(body.savingsGoal ?? 0);
    const savedAmount = parseNonNegativeNumber(body.savedAmount ?? 0);

    if (!city) return NextResponse.json({ ok: false, message: 'city is required.' }, { status: 400 });
    if (!country) return NextResponse.json({ ok: false, message: 'country is required.' }, { status: 400 });
    if (!imageRaw) return NextResponse.json({ ok: false, message: 'image is required.' }, { status: 400 });
    if (!isTripType(tripType)) return NextResponse.json({ ok: false, message: 'tripType is invalid.' }, { status: 400 });
    if (!isVibe(vibe)) return NextResponse.json({ ok: false, message: 'vibe is invalid.' }, { status: 400 });
    if (budgetEstimate === null || savingsGoal === null || savedAmount === null) {
      return NextResponse.json({ ok: false, message: 'budgetEstimate/savingsGoal/savedAmount must be non-negative numbers.' }, { status: 400 });
    }

    const image = await persistTravelImage(imageRaw, 'dreams');

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE travel_dreams
       SET city = ?, country = ?, image = ?, budget_estimate = ?, trip_type = ?, why_text = ?, vibe = ?, savings_goal = ?, saved_amount = ?
       WHERE id = ? AND user_id = ?`,
      [
        city,
        country,
        image,
        budgetEstimate,
        tripType,
        why || null,
        vibe,
        savingsGoal,
        savedAmount,
        id,
        userId,
      ],
    );

    if (!result.affectedRows) {
      return NextResponse.json({ ok: false, message: 'Destination not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TravelImagePersistError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: 'Unable to update destination.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  try {
    await ensureTravelTables();
    const userId = getTravelUserId();
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, message: 'Invalid id.' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM travel_dreams WHERE id = ? AND user_id = ?`,
      [id, userId],
    );
    if (!result.affectedRows) {
      return NextResponse.json({ ok: false, message: 'Destination not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to delete destination.' }, { status: 500 });
  }
}
