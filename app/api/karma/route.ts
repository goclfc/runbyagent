import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { KARMA_DELTAS } from '@/lib/auth';
import { awardKarma, KarmaKind } from '@/lib/karma';

export const dynamic = 'force-dynamic';

function authorized(request: NextRequest): boolean {
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  const accepted = [process.env.AUTH_SECRET, process.env.ADMIN_KEY].filter(Boolean);
  return accepted.length > 0 && accepted.includes(token);
}

/**
 * projects report karma here. bearer AUTH_SECRET (or ADMIN_KEY).
 * body: { username | user_id, app, kind: upvote | reply, ref }
 * idempotent on (user, app, kind, ref).
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { username, user_id, app, kind, ref } = body;

    if (typeof app !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(app)) {
      return NextResponse.json({ error: 'app is required' }, { status: 400 });
    }
    if (typeof kind !== 'string' || !(kind in KARMA_DELTAS)) {
      return NextResponse.json({ error: `kind must be one of: ${Object.keys(KARMA_DELTAS).join(', ')}` }, { status: 400 });
    }
    if (typeof ref !== 'string' || ref.length === 0 || ref.length > 200) {
      return NextResponse.json({ error: 'ref is required' }, { status: 400 });
    }

    let userId: number | null = null;
    if (typeof user_id === 'number') {
      const rows = await query<{ id: number }>('SELECT id FROM users WHERE id = $1', [user_id]);
      userId = rows[0]?.id ?? null;
    } else if (typeof username === 'string') {
      const rows = await query<{ id: number }>('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
      userId = rows[0]?.id ?? null;
    }
    if (!userId) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 });
    }

    const result = await awardKarma(userId, app, kind as KarmaKind, ref);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error awarding karma:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
