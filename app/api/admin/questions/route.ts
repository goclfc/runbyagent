import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import {
  getOpenQuestion, getQuestionDetail, listQuestions, slugify, isValidSlug, parseXPost,
  cleanOptions, cleanClosesIn, TITLE_MAX, Question,
} from '@/lib/questions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const questions = await listQuestions();
  return NextResponse.json({ questions });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
    if (title.length > TITLE_MAX) return NextResponse.json({ error: `title must be ${TITLE_MAX} characters or less` }, { status: 400 });

    const slug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : slugify(title);
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: 'slug must be lowercase letters, digits and dashes (and not "current")' }, { status: 400 });
    }

    const options = cleanOptions(body.options);
    if ('error' in options) return NextResponse.json({ error: options.error }, { status: 400 });

    const closesIn = cleanClosesIn(body.closes_in_hours);
    if (typeof closesIn !== 'number') return NextResponse.json({ error: closesIn.error }, { status: 400 });

    const contextMd = typeof body.context_md === 'string' ? body.context_md : '';

    let xPost: { id: string; url: string } | null = null;
    if (body.x_post_url !== undefined && body.x_post_url !== null && body.x_post_url !== '') {
      xPost = parseXPost(body.x_post_url);
      if (!xPost) return NextResponse.json({ error: 'x_post_url must be an x.com status link or a post id' }, { status: 400 });
    }

    const open = await getOpenQuestion();
    if (open) {
      return NextResponse.json({ error: `"${open.title}" is still open. close or decide it first.`, open }, { status: 409 });
    }

    const taken = await query('SELECT 1 FROM questions WHERE slug = $1', [slug]);
    if (taken.length > 0) return NextResponse.json({ error: 'slug already used' }, { status: 409 });

    const inserted = await query<Question>(
      `INSERT INTO questions (slug, title, context_md, status, x_post_id, x_post_url, opened_at, closes_at)
       VALUES ($1, $2, $3, 'open', $4, $5, NOW(), NOW() + ($6 || ' hours')::interval)
       RETURNING *`,
      [slug, title, contextMd, xPost?.id ?? null, xPost?.url ?? null, String(closesIn)]
    );
    const question = inserted[0];

    for (let i = 0; i < options.labels.length; i++) {
      await query(
        'INSERT INTO question_options (question_id, position, label) VALUES ($1, $2, $3)',
        [question.id, i + 1, options.labels[i]]
      );
    }

    const detail = await getQuestionDetail(question, null);
    return NextResponse.json(detail, { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
