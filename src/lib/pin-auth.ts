const COOKIE_NAME = 'sp_pin_auth';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const TOKEN_VERSION = 'v1';
const DEFAULT_APP_PIN = '080803';

function encoder() {
  return new TextEncoder();
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder().encode(message));
  return toHex(signature);
}

export function getPinConfig() {
  const pin = process.env.APP_PIN?.trim() || DEFAULT_APP_PIN;
  const secret = process.env.PIN_AUTH_SECRET?.trim() || pin;
  return { pin, secret };
}

export function hasPinConfigured() {
  const { pin, secret } = getPinConfig();
  return pin.length > 0 && secret.length > 0;
}

export function shouldUseSecurePinCookie() {
  const raw = process.env.PIN_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return process.env.NODE_ENV === 'production';
}

export async function createPinCookieValue(pin: string, secret: string) {
  return `${TOKEN_VERSION}:${await hmacHex(secret, `${TOKEN_VERSION}:${pin}`)}`;
}

export async function isValidPinCookieValue(value: string | undefined, pin: string, secret: string) {
  if (!value) return false;
  const expected = await createPinCookieValue(pin, secret);
  return safeEqual(value, expected);
}

export { COOKIE_MAX_AGE_SECONDS, COOKIE_NAME };
