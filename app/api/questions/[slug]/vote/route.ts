import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getQuestionBySlug, getOptions, getReplies, getMyVote } from '@/lib/questions';
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
    const body = await request.json();
    const question = await getQuestionBySlug(slug);
    if (!question) {
      return NextResponse.json({ error: 'question not found' }, { status: 404 });
    }
    if (question.status !== 'open') {
      return NextResponse.json({ error: 'this question is closed' }, { status: 409 });
    }

    const customBody = typeof body.body === 'string' ? body.body.trim() : '';
    const optionId = typeof body.option_id === 'number' ? body.option_id : Number(body.option_id);

    if (customBody) {
      if (body.website && String(body.website).trim().length > 0) {
        return NextResponse.json({ success: true });
      }
      if (!body.t0 || !verifyDwellTimeToken(body.t0, 3)) {
        return NextResponse.json({ error: 'slow down' }, { status: 400 });
      }
      if (customBody.length > 200) {
        return NextResponse.json({ error: 'answer must be 200 characters or less' }, { status: 400 });
      }
    } else if (!Number.isInteger(optionId)) {
      return NextResponse.json({ error: 'pick an answer or add your own' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    if (clientIp) {
      const ipHash = hashIp(clientIp);
      const allowed = await checkRateLimit([
        { key: `ip:${ipHash}:qvote`, maxCount: 20, windowMinutes: 60 },
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

    const user = await getSessionUser();
    const author = user?.username || null;
    let chosenId = optionId;
    let replyBody = '';

    if (customBody) {
      const existing = await query<{ id: number }>(
        `SELECT id FROM question_options
         WHERE question_id = $1 AND LOWER(body) = LOWER($2)
         LIMIT 1`,
        [question.id, customBody]
      );
      if (existing[0]) {
        chosenId = existing[0].id;
      } else {
        const inserted = await query<{ id: number }>(
          `INSERT INTO question_options (question_id, body, sort, kind, visitor_id, user_id, author)
           VALUES ($1, $2, 100, 'custom', $3, $4, $5)
           RETURNING id`,
          [question.id, customBody, visitorId, user?.id ?? null, author]
        );
        chosenId = inserted[0].id;
      }
      replyBody = customBody;
    } else {
      const options = await query<{ id: number; body: string }>(
        'SELECT id, body FROM question_options WHERE id = $1 AND question_id = $2',
        [chosenId, question.id]
      );
      if (!options[0]) {
        return NextResponse.json({ error: 'answer not found' }, { status: 404 });
      }
      replyBody = `picked: ${options[0].body}`;
    }

    const previous = await query<{ option_id: number }>(
      'SELECT option_id FROM question_votes WHERE question_id = $1 AND visitor_id = $2',
      [question.id, visitorId]
    );
    const previousId = previous[0]?.option_id;

    await query(
      `INSERT INTO question_votes (question_id, visitor_id, option_id, user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (question_id, visitor_id)
       DO UPDATE SET option_id = $3, user_id = COALESCE($4, question_votes.user_id), created_at = NOW()`,
      [question.id, visitorId, chosenId, user?.id ?? null]
    );

    if (previousId !== chosenId) {
      await query(
        `INSERT INTO question_replies (question_id, option_id, visitor_id, user_id, author, body)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [question.id, chosenId, visitorId, user?.id ?? null, author, replyBody]
      );
    }

    let karma: number | undefined;
    if (user) {
      const result = await awardKarma(user.id, 'runbyagent', 'upvote', `question:${slug}`);
      karma = result.karma;
      if (customBody && !previousId) {
        const extra = await awardKarma(user.id, 'runbyagent', 'reply', `question-answer:${slug}:${chosenId}`);
        karma = extra.karma;
      }
    }

    if (clientIp) {
      await incrementRateLimit(`ip:${hashIp(clientIp)}:qvote`);
    }

    const [options, replies, my_vote] = await Promise.all([
      getOptions(question.id),
      getReplies(question.id),
      getMyVote(question.id, visitorId),
    ]);

    const response = NextResponse.json({
      success: true,
      question: { ...question, vote_count: options.reduce((n, o) => n + o.votes, 0), reply_count: replies.length },
      options,
      replies,
      my_vote,
      ...(karma !== undefined ? { karma } : {}),
    });
    await setVisitorCookie(visitorId);
    return response;
  } catch (error) {
    console.error('Error voting on question:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
