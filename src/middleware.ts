import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, getPinConfig, hasPinConfigured, isValidPinCookieValue } from './lib/pin-auth';

const PIN_PATH = '/pin';

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/Images/') ||
    pathname.startsWith('/SathiPlays/Images/') ||
    pathname === '/api/auth/pin' ||
    pathname === '/api/health'
  );
}

export async function middleware(request: NextRequest) {
  if (!hasPinConfigured()) return NextResponse.next();

  const { pin, secret } = getPinConfig();
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const authorized = await isValidPinCookieValue(cookieValue, pin, secret);
  const isApi = pathname.startsWith('/api/');
  const isPinPage = pathname === PIN_PATH;

  if (authorized && isPinPage) {
    const next = request.nextUrl.searchParams.get('next');
    const redirectTo = next && next.startsWith('/') ? next : '/';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  if (authorized) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ ok: false, message: 'PIN required.' }, { status: 401 });
  }

  if (isPinPage) return NextResponse.next();

  const nextUrl = `${pathname}${search}`;
  const loginUrl = new URL(PIN_PATH, request.url);
  loginUrl.searchParams.set('next', nextUrl);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
