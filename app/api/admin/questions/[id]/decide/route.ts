import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { findQuestionByIdOrSlug, getQuestionDetail, getResults, getWriteins, decisionLogBody } from '@/lib/questions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** write the decision. closes the question if it is still open and posts a `decision` entry to the changelog. */
export async function POST(request: NextRequest, { params }: Params) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const question = await findQuestionByIdOrSlug(id);
    if (!question) return NextResponse.json({ error: 'question not found' }, { status: 404 });
    if (question.status === 'decided') {
      return NextResponse.json({ error: 'this question already has a decision' }, { status: 409 });
    }

    const body = await request.json();
    const decisionMd = typeof body.decision_md === 'string' ? body.decision_md.trim() : '';
    if (!decisionMd) return NextResponse.json({ error: 'decision_md is required' }, { status: 400 });
    if (decisionMd.length > 20000) return NextResponse.json({ error: 'decision_md is too long' }, { status: 400 });

    const author = typeof body.author === 'string' && /^[a-z0-9_+-]{1,32}$/i.test(body.author) ? body.author : 'agent+gocha';
    const xUrl = typeof body.x_url === 'string' && body.x_url.trim() ? body.x_url.trim() : question.x_post_url;

    const [results, writeins] = await Promise.all([getResults(question.id), getWriteins(question.id)]);
    const logBody = decisionLogBody(question, decisionMd, results, writeins);

    const log = await query<{ id: number }>(
      `INSERT INTO log_entries (project_id, body, kind, x_url, author)
       VALUES (NULL, $1, 'decision', $2, $3)
       RETURNING id`,
      [logBody, xUrl, author]
    );

    await query(
      `UPDATE questions
       SET status = 'decided',
           decided_at = NOW(),
           decision_md = $2,
           decision_log_id = $3,
           closes_at = LEAST(closes_at, NOW())
       WHERE id = $1`,
      [question.id, decisionMd, log[0].id]
    );

    const updated = await findQuestionByIdOrSlug(String(question.id));
    const detail = await getQuestionDetail(updated!, null);
    return NextResponse.json({ ...detail, log_entry: { id: log[0].id, body: logBody } });
  } catch (error) {
    console.error('Error deciding question:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
