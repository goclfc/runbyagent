import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { cookies } from 'next/headers';
import { query } from './db';

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>;

export const SESSION_COOKIE = 'rba_user';
const SESSION_DAYS = 30;
const HANDOFF_SECONDS = 60;

export const KARMA_DELTAS: Record<string, number> = {
  upvote: 1,
  reply: 5,
};

/** the shared secret. painboard (and every future project) must have the same one to accept handoffs. */
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.ADMIN_KEY;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set');
  }
  return secret;
}

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function validateUsername(value: unknown): string | null {
  if (typeof value !== 'string') return 'username is required';
  if (!USERNAME_RE.test(value)) return 'username must be 3 to 20 letters, digits or underscores';
  return null;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string') return 'password is required';
  if (value.length < 8) return 'password must be at least 8 characters';
  if (value.length > 200) return 'password must be 200 characters or less';
  return null;
}

// ---- passwords: scrypt with a random salt, parameters stored next to the hash ----

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  try {
    const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// ---- tokens: base64url(json).hmac-sha256, signed with the shared secret ----

export type TokenType = 'session' | 'handoff';

export interface TokenPayload {
  sub: number;        // user id
  u: string;          // username
  t: TokenType;
  exp: number;        // unix seconds
  aud?: string;       // handoff only: origin the token was issued for
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function sign(body: string): string {
  return b64url(createHmac('sha256', authSecret()).update(body).digest());
}

export function signToken(payload: TokenPayload): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string | undefined | null, type: TokenType): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as TokenPayload;
    if (payload.t !== type) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    if (typeof payload.sub !== 'number' || typeof payload.u !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionToken(user: { id: number; username: string }): string {
  return signToken({
    sub: user.id,
    u: user.username,
    t: 'session',
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60,
  });
}

export function handoffToken(user: { id: number; username: string }, audience: string): string {
  return signToken({
    sub: user.id,
    u: user.username,
    t: 'handoff',
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + HANDOFF_SECONDS,
  });
}

export function sessionCookieOptions(maxAgeSeconds: number = SESSION_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

// ---- session ----

export interface SessionUser {
  id: number;
  username: string;
  karma: number;
  created_at: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get(SESSION_COOKIE)?.value;
  } catch {
    return null;
  }
  const payload = verifyToken(token, 'session');
  if (!payload) return null;
  const rows = await query<SessionUser>(
    'SELECT id, username, karma, created_at FROM users WHERE id = $1',
    [payload.sub]
  );
  return rows[0] || null;
}

export async function findUserByUsername(username: string): Promise<(SessionUser & { password_hash: string }) | null> {
  const rows = await query<SessionUser & { password_hash: string }>(
    'SELECT id, username, karma, created_at, password_hash FROM users WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  return rows[0] || null;
}

// ---- handoff targets ----

/** origins that may receive a handoff token. painboard by default, plus AUTH_RETURN_ORIGINS (comma separated). */
export function allowedReturnOrigins(): string[] {
  const origins = new Set<string>();
  const add = (value?: string) => {
    if (!value) return;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // ignore malformed entries
    }
  };
  add(process.env.PAINBOARD_URL || 'https://painboard.usectl.com');
  add(process.env.SITE_URL);
  for (const item of (process.env.AUTH_RETURN_ORIGINS || '').split(',')) add(item.trim());
  return Array.from(origins);
}

export function isAllowedReturnUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (local && process.env.NODE_ENV !== 'production') return url;
  return allowedReturnOrigins().includes(url.origin) ? url : null;
}

/** a post-login destination: only same-site paths are accepted, anything else falls back to "/". */
export function safeLocalPath(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

/** same-site redirect with a relative Location. behind the usectl ingress request.url is the pod's
 *  internal hostname, so absolute redirects built from it point at an unreachable host. */
export function redirectTo(path: string, status: 302 | 303 = 302): Response {
  return new Response(null, { status, headers: { Location: path } });
}
