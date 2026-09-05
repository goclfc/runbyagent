import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getQuestionBySlug, getQuestionDetail, WRITEIN_MAX } from '@/lib/questions';
import { getSessionUser } from '@/lib/auth';
import { hashIp, getClientIp, checkRateLimit, incrementRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const WRITEINS_PER_USER = 3;

/** add your own answer. logged in only, 200 characters, up to three per person per question. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'log in to add an answer' }, { status: 401 });
    }

    const question = await getQuestionBySlug(slug);
    if (!question) return NextResponse.json({ error: 'question not found' }, { status: 404 });
    if (question.status !== 'open') {
      return NextResponse.json({ error: 'this question has closed' }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body.body === 'string' ? body.body.replace(/\s+/g, ' ').trim() : '';
    if (!text) return NextResponse.json({ error: 'write something first' }, { status: 400 });
    if (text.length > WRITEIN_MAX) {
      return NextResponse.json({ error: `keep it to ${WRITEIN_MAX} characters` }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    if (clientIp) {
      const allowed = await checkRateLimit([{ key: `ip:${hashIp(clientIp)}:writein`, maxCount: 10, windowMinutes: 60 }]);
      if (!allowed) return NextResponse.json({ error: 'slow down' }, { status: 429 });
    }

    const mine = await query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM question_writeins WHERE question_id = $1 AND user_id = $2',
      [question.id, user.id]
    );
    if (mine[0].n >= WRITEINS_PER_USER) {
      return NextResponse.json({ error: `you already added ${WRITEINS_PER_USER} answers to this question` }, { status: 409 });
    }

    const duplicate = await query(
      'SELECT 1 FROM question_writeins WHERE question_id = $1 AND LOWER(body) = LOWER($2)',
      [question.id, text]
    );
    if (duplicate.length > 0) {
      return NextResponse.json({ error: 'someone already suggested that. upvote it instead.' }, { status: 409 });
    }

    const inserted = await query<{ id: number }>(
      'INSERT INTO question_writeins (question_id, user_id, body) VALUES ($1, $2, $3) RETURNING id',
      [question.id, user.id, text]
    );
    if (clientIp) await incrementRateLimit(`ip:${hashIp(clientIp)}:writein`);

    const detail = await getQuestionDetail(question, user.id);
    return NextResponse.json({ ...detail, writein_id: inserted[0].id }, { status: 201 });
  } catch (error) {
    console.error('Error adding write-in:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
