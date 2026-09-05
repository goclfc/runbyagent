import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getQuestionBySlug, getQuestionDetail } from '@/lib/questions';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** one vote per user. voting again moves the vote. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'log in to vote' }, { status: 401 });
    }

    const question = await getQuestionBySlug(slug);
    if (!question) return NextResponse.json({ error: 'question not found' }, { status: 404 });
    if (question.status !== 'open') {
      return NextResponse.json({ error: 'voting has closed' }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const optionId = Number(body.option_id);
    if (!Number.isInteger(optionId)) return NextResponse.json({ error: 'option_id is required' }, { status: 400 });

    const option = await query<{ id: number }>(
      'SELECT id FROM question_options WHERE id = $1 AND question_id = $2',
      [optionId, question.id]
    );
    if (option.length === 0) return NextResponse.json({ error: 'option not found' }, { status: 404 });

    await query(
      `INSERT INTO question_votes (question_id, user_id, option_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (question_id, user_id) DO UPDATE SET option_id = EXCLUDED.option_id, created_at = NOW()`,
      [question.id, user.id, optionId]
    );

    return NextResponse.json(await getQuestionDetail(question, user.id));
  } catch (error) {
    console.error('Error voting:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
