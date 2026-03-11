import { NextResponse } from 'next/server';
import { getActionRowToday } from '../../../../../lib/glow-action-row';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getActionRowToday());
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load action row today.' }, { status: 500 });
  }
}
