import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getQuestionBySlug, getQuestionDetail, writeinUpvoteRef, Writein } from '@/lib/questions';
import { getSessionUser } from '@/lib/auth';
import { awardKarma } from '@/lib/karma';

export const dynamic = 'force-dynamic';

/** upvote a write-in once. the author earns a karma point (kind writein_upvote); the upvote itself is the karma event. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await params;
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'log in to upvote' }, { status: 401 });
    }

    const question = await getQuestionBySlug(slug);
    if (!question) return NextResponse.json({ error: 'question not found' }, { status: 404 });
    if (question.status !== 'open') {
      return NextResponse.json({ error: 'this question has closed' }, { status: 409 });
    }

    const writeinId = Number(id);
    if (!Number.isInteger(writeinId)) return NextResponse.json({ error: 'write-in not found' }, { status: 404 });
    const rows = await query<Writein>(
      'SELECT * FROM question_writeins WHERE id = $1 AND question_id = $2',
      [writeinId, question.id]
    );
    const writein = rows[0];
    if (!writein) return NextResponse.json({ error: 'write-in not found' }, { status: 404 });
    if (writein.user_id === user.id) {
      return NextResponse.json({ error: 'you cannot upvote your own answer' }, { status: 400 });
    }

    const result = await awardKarma(writein.user_id, 'runbyagent', 'writein_upvote', writeinUpvoteRef(question.id, writein.id, user.id));
    if (result.awarded) {
      await query('UPDATE question_writeins SET karma = karma + 1 WHERE id = $1', [writein.id]);
    }

    const detail = await getQuestionDetail(question, user.id);
    return NextResponse.json({ ...detail, awarded: result.awarded });
  } catch (error) {
    console.error('Error upvoting write-in:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
