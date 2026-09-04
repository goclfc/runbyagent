import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// public read-only data: other projects (painboard) read it from the browser
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** public profile: karma, rank, and the last 50 things it came from */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const users = await query<{ id: number; username: string; karma: number; created_at: string; rank: number }>(
      `SELECT id, username, karma, created_at,
              (SELECT COUNT(*) + 1 FROM users o WHERE o.karma > u.karma OR (o.karma = u.karma AND o.created_at < u.created_at))::int AS rank
       FROM users u
       WHERE LOWER(username) = LOWER($1)`,
      [username]
    );
    const user = users[0];
    if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404, headers: CORS });

    const events = await query(
      `SELECT app, kind, ref, delta, created_at
       FROM karma_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id]
    );
    const { id, ...publicUser } = user;
    return NextResponse.json({ user: publicUser, events }, { headers: CORS });
  } catch (error) {
    console.error('Error loading user:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
