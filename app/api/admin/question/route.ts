import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SLUG_RE } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    const options = Array.isArray(body.options) ? body.options : [];
    const closeOutcome = typeof body.close_outcome === 'string' ? body.close_outcome.trim() : '';

    if (!SLUG_RE.test(slug) || slug === 'open') {
      return NextResponse.json({ error: 'slug must be 3-48 lowercase letters, digits or dashes' }, { status: 400 });
    }
    if (!text || text.length > 500) {
      return NextResponse.json({ error: 'body is required and must be 500 characters or less' }, { status: 400 });
    }

    const preset = options
      .filter((item: unknown) => typeof item === 'string' && item.trim().length > 0)
      .map((item: string) => item.trim())
      .slice(0, 8);

    if (preset.length < 2) {
      return NextResponse.json({ error: 'at least two possible answers are required' }, { status: 400 });
    }

    const open = await query<{ id: number; slug: string }>(
      "SELECT id, slug FROM questions WHERE status = 'open'"
    );
    if (open[0]) {
      await query(
        `UPDATE questions
         SET status = 'closed', closed_at = NOW(), outcome = $2
         WHERE id = $1`,
        [open[0].id, closeOutcome || `replaced by ${slug}`]
      );
    }

    const created = await query<{ id: number; slug: string; body: string; status: string }>(
      `INSERT INTO questions (slug, body, status)
       VALUES ($1, $2, 'open')
       RETURNING id, slug, body, status`,
      [slug, text]
    );

    for (let i = 0; i < preset.length; i++) {
      await query(
        `INSERT INTO question_options (question_id, body, sort, kind)
         VALUES ($1, $2, $3, 'preset')`,
        [created[0].id, preset[i], i + 1]
      );
    }

    await query(
      `INSERT INTO log_entries (body, kind) VALUES ($1, 'note')`,
      [`open question: ${text}`]
    );

    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const outcome = typeof body.outcome === 'string' ? body.outcome.trim() : '';
    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }
    if (!outcome || outcome.length > 280) {
      return NextResponse.json({ error: 'outcome is required, one line, 280 characters or less' }, { status: 400 });
    }

    const rows = await query(
      `UPDATE questions
       SET status = 'closed', closed_at = NOW(), outcome = $2
       WHERE slug = $1 AND status = 'open'
       RETURNING id, slug, body, status, outcome`,
      [slug, outcome]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'open question not found' }, { status: 404 });
    }

    await query(
      `INSERT INTO log_entries (body, kind) VALUES ($1, 'note')`,
      [`question closed: ${outcome}`]
    );

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error closing question:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
