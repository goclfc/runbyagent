import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import {
  findQuestionByIdOrSlug, getQuestionDetail, getOptions, parseXPost, cleanOptions, cleanClosesIn, TITLE_MAX,
} from '@/lib/questions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const question = await findQuestionByIdOrSlug(id);
  if (!question) return NextResponse.json({ error: 'question not found' }, { status: 404 });
  return NextResponse.json(await getQuestionDetail(question, null));
}

/** edit title, context, options, x post or the closing time. options can only change while the question is open. */
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const question = await findQuestionByIdOrSlug(id);
    if (!question) return NextResponse.json({ error: 'question not found' }, { status: 404 });

    const body = await request.json();
    const sets: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
      if (title.length > TITLE_MAX) return NextResponse.json({ error: `title must be ${TITLE_MAX} characters or less` }, { status: 400 });
      push('title', title);
    }

    if (body.context_md !== undefined) {
      if (typeof body.context_md !== 'string') return NextResponse.json({ error: 'context_md must be a string' }, { status: 400 });
      push('context_md', body.context_md);
    }

    if (body.x_post_url !== undefined) {
      if (body.x_post_url === null || body.x_post_url === '') {
        push('x_post_id', null);
        push('x_post_url', null);
      } else {
        const xPost = parseXPost(body.x_post_url);
        if (!xPost) return NextResponse.json({ error: 'x_post_url must be an x.com status link or a post id' }, { status: 400 });
        push('x_post_id', xPost.id);
        push('x_post_url', xPost.url);
      }
    }

    if (body.closes_in_hours !== undefined) {
      if (question.status !== 'open') return NextResponse.json({ error: 'only an open question can change its closing time' }, { status: 409 });
      const hours = cleanClosesIn(body.closes_in_hours);
      if (typeof hours !== 'number') return NextResponse.json({ error: hours.error }, { status: 400 });
      values.push(String(hours));
      sets.push(`closes_at = opened_at + ($${values.length} || ' hours')::interval`);
    }

    if (body.reopen === true) {
      if (question.status !== 'closed') return NextResponse.json({ error: 'only a closed question can be reopened' }, { status: 409 });
      const open = await query('SELECT 1 FROM questions WHERE status = $1 AND id <> $2', ['open', question.id]);
      if (open.length > 0) return NextResponse.json({ error: 'another question is open' }, { status: 409 });
      const hours = cleanClosesIn(body.closes_in_hours ?? 24);
      if (typeof hours !== 'number') return NextResponse.json({ error: hours.error }, { status: 400 });
      push('status', 'open');
      values.push(String(hours));
      sets.push(`closes_at = NOW() + ($${values.length} || ' hours')::interval`);
    }

    if (body.close === true) {
      if (question.status !== 'open') return NextResponse.json({ error: 'the question is not open' }, { status: 409 });
      push('status', 'closed');
      sets.push('closes_at = NOW()');
    }

    let newLabels: string[] | null = null;
    if (body.options !== undefined) {
      if (question.status !== 'open' && body.reopen !== true) {
        return NextResponse.json({ error: 'options can only change while the question is open' }, { status: 409 });
      }
      const cleaned = cleanOptions(body.options);
      if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 });
      const existing = await getOptions(question.id);
      if (cleaned.labels.length < existing.length) {
        return NextResponse.json({ error: 'options cannot be removed once the question is open, only renamed or added' }, { status: 400 });
      }
      newLabels = cleaned.labels;
    }

    if (sets.length === 0 && !newLabels) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    }

    if (sets.length > 0) {
      values.push(question.id);
      await query(`UPDATE questions SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
    }

    if (newLabels) {
      for (let i = 0; i < newLabels.length; i++) {
        await query(
          `INSERT INTO question_options (question_id, position, label) VALUES ($1, $2, $3)
           ON CONFLICT (question_id, position) DO UPDATE SET label = EXCLUDED.label`,
          [question.id, i + 1, newLabels[i]]
        );
      }
    }

    const updated = await findQuestionByIdOrSlug(String(question.id));
    return NextResponse.json(await getQuestionDetail(updated!, null));
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
