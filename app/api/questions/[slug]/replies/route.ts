import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getQuestionBySlug, getReplies } from '@/lib/questions';
import { getOrCreateVisitorId, setVisitorCookie } from '@/lib/visitor';
import { hashIp, getClientIp, checkRateLimit, incrementRateLimit, verifyDwellTimeToken } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/auth';
import { awardKarma } from '@/lib/karma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const payload = await request.json();
    const text = typeof payload.body === 'string' ? payload.body.trim() : '';

    if (payload.website && String(payload.website).trim().length > 0) {
      return NextResponse.json({ success: true, id: 0 });
    }
    if (!payload.t0 || !verifyDwellTimeToken(payload.t0, 3)) {
      return NextResponse.json({ error: 'slow down' }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: 'body must be 2000 characters or less' }, { status: 400 });
    }

    const question = await getQuestionBySlug(slug);
    if (!question) {
      return NextResponse.json({ error: 'question not found' }, { status: 404 });
    }
    if (question.status !== 'open') {
      return NextResponse.json({ error: 'this question is closed' }, { status: 409 });
    }

    const clientIp = getClientIp(request);
    if (clientIp) {
      const ipHash = hashIp(clientIp);
      const allowed = await checkRateLimit([
        { key: `ip:${ipHash}:comment`, maxCount: 5, windowMinutes: 60 },
        { key: `ip:${ipHash}:comment_daily`, maxCount: 20, windowMinutes: 1440 },
      ]);
      if (!allowed) {
        return NextResponse.json({ error: 'slow down' }, { status: 429 });
      }
    }

    const { id: visitorId, isNew } = await getOrCreateVisitorId();
    if (isNew && clientIp) {
      const ipHash = hashIp(clientIp);
      const visitorAllowed = await checkRateLimit([
        { key: `ip:${ipHash}:visitor`, maxCount: 5, windowMinutes: 60 },
      ]);
      if (!visitorAllowed) {
        return NextResponse.json({ error: 'slow down' }, { status: 429 });
      }
      await incrementRateLimit(`ip:${ipHash}:visitor`);
    }

    const visitorAllowed = await checkRateLimit([
      { key: `visitor:${visitorId}:comment`, maxCount: 10, windowMinutes: 60 },
    ]);
    if (!visitorAllowed) {
      return NextResponse.json({ error: 'slow down' }, { status: 429 });
    }

    const user = await getSessionUser();
    const author = user ? user.username : (typeof payload.name === 'string' ? payload.name.trim() || null : null);

    const inserted = await query<{ id: number }>(
      `INSERT INTO question_replies (question_id, visitor_id, user_id, author, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [question.id, visitorId, user?.id ?? null, author, text]
    );

    let karma: number | undefined;
    if (user) {
      const awarded = await awardKarma(user.id, 'runbyagent', 'reply', `question-reply:${inserted[0].id}`);
      karma = awarded.karma;
    }

    if (clientIp) {
      const ipHash = hashIp(clientIp);
      await incrementRateLimit(`ip:${ipHash}:comment`);
      await incrementRateLimit(`ip:${ipHash}:comment_daily`);
    }
    await incrementRateLimit(`visitor:${visitorId}:comment`);

    const replies = await getReplies(question.id);
    const response = NextResponse.json({
      success: true,
      id: inserted[0].id,
      replies,
      ...(karma !== undefined ? { karma } : {}),
    });
    await setVisitorCookie(visitorId);
    return response;
  } catch (error) {
    console.error('Error posting question reply:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
