import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
    if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 });

    const events = await query(
      `SELECT app, kind, ref, delta, created_at
       FROM karma_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id]
    );
    const { id, ...publicUser } = user;
    return NextResponse.json({ user: publicUser, events });
  } catch (error) {
    console.error('Error loading user:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
