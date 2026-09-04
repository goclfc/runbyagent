import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { findUserByUsername, sessionCookieOptions, sessionToken, SESSION_COOKIE, verifyPassword } from '@/lib/auth';
import { checkRateLimit, getClientIp, hashIp, incrementRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username, password } = body;
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const ipHash = clientIp ? hashIp(clientIp) : null;
    const limits = [{ key: `user:${username.toLowerCase()}:login`, maxCount: 10, windowMinutes: 15 }];
    if (ipHash) limits.push({ key: `ip:${ipHash}:login`, maxCount: 30, windowMinutes: 15 });
    if (!(await checkRateLimit(limits))) {
      return NextResponse.json({ error: 'slow down' }, { status: 429 });
    }

    const user = await findUserByUsername(username);
    const ok = user ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !ok) {
      await incrementRateLimit(`user:${username.toLowerCase()}:login`);
      if (ipHash) await incrementRateLimit(`ip:${ipHash}:login`);
      return NextResponse.json({ error: 'wrong username or password' }, { status: 401 });
    }

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const { password_hash, ...publicUser } = user;
    const response = NextResponse.json({ user: publicUser });
    response.cookies.set(SESSION_COOKIE, sessionToken(user), sessionCookieOptions());
    return response;
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
