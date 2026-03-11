import { NextRequest, NextResponse } from 'next/server';
import {
  COOKIE_MAX_AGE_SECONDS,
  COOKIE_NAME,
  createPinCookieValue,
  getPinConfig,
  hasPinConfigured,
  shouldUseSecurePinCookie,
} from '../../../../lib/pin-auth';

type PinRequest = {
  pin?: string;
};

export async function POST(request: NextRequest) {
  if (!hasPinConfigured()) {
    return NextResponse.json({ ok: true, message: 'PIN not configured.' });
  }

  const { pin, secret } = getPinConfig();
  const body = (await request.json().catch(() => null)) as PinRequest | null;
  const providedPin = body?.pin?.trim() ?? '';

  if (providedPin !== pin) {
    return NextResponse.json({ ok: false, message: 'Incorrect PIN.' }, { status: 401 });
  }

  const cookieValue = await createPinCookieValue(pin, secret);
  const secureCookie = shouldUseSecurePinCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}

export async function DELETE() {
  const secureCookie = shouldUseSecurePinCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
