import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * server-to-server: a project that does not share AUTH_SECRET can still log people in.
 * body: { token } (a handoff token from /api/auth/handoff). returns the user it names.
 * tokens live 60 seconds, so the replay window is the redirect itself.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = verifyToken(body?.token, 'handoff');
    if (!payload) {
      return NextResponse.json({ error: 'invalid or expired token' }, { status: 401 });
    }
    const rows = await query<{ id: number; username: string; karma: number; created_at: string }>(
      'SELECT id, username, karma, created_at FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!rows[0]) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 });
    }
    return NextResponse.json({ user: rows[0], aud: payload.aud ?? null, exp: payload.exp });
  } catch (error) {
    console.error('Error exchanging token:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
