import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, sessionCookieOptions, sessionToken, SESSION_COOKIE, validatePassword, validateUsername, findUserByUsername } from '@/lib/auth';
import { checkRateLimit, getClientIp, hashIp, incrementRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username, password } = body;

    const usernameError = validateUsername(username);
    if (usernameError) return NextResponse.json({ error: usernameError }, { status: 400 });
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const clientIp = getClientIp(request);
    const ipHash = clientIp ? hashIp(clientIp) : null;
    if (ipHash) {
      const allowed = await checkRateLimit([{ key: `ip:${ipHash}:register`, maxCount: 5, windowMinutes: 60 }]);
      if (!allowed) return NextResponse.json({ error: 'slow down' }, { status: 429 });
    }

    if (await findUserByUsername(username)) {
      return NextResponse.json({ error: 'that username is taken' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const rows = await query<{ id: number; username: string; karma: number; created_at: string }>(
      `INSERT INTO users (username, password_hash, last_login_at)
       VALUES ($1, $2, NOW())
       RETURNING id, username, karma, created_at`,
      [username, passwordHash]
    );
    const user = rows[0];
    if (ipHash) await incrementRateLimit(`ip:${ipHash}:register`);

    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, sessionToken(user), sessionCookieOptions());
    return response;
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'that username is taken' }, { status: 409 });
    }
    console.error('Error registering user:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
