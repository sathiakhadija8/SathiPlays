import { NextResponse } from 'next/server';
import { listBeautyRecipes, listSeedWaters } from '../../../../../lib/glow-drinks';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [seedWaters, beautyDrinkRecipes] = await Promise.all([listSeedWaters(), listBeautyRecipes()]);
    return NextResponse.json({
      seed_waters: seedWaters,
      beauty_drink_recipes: beautyDrinkRecipes,
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Unable to load drinks system.' }, { status: 500 });
  }
}
