import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { findQuestionByIdOrSlug, getQuestionDetail, getOptions, MAX_OPTIONS, OPTION_MAX, Writein } from '@/lib/questions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** turn a write-in into an option. site-only: x polls cannot grow after they are posted. */
export async function POST(request: NextRequest, { params }: Params) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const question = await findQuestionByIdOrSlug(id);
    if (!question) return NextResponse.json({ error: 'question not found' }, { status: 404 });
    if (question.status !== 'open') {
      return NextResponse.json({ error: 'write-ins can only be promoted while the question is open' }, { status: 409 });
    }

    const body = await request.json();
    const writeinId = Number(body.writein_id);
    if (!Number.isInteger(writeinId)) return NextResponse.json({ error: 'writein_id is required' }, { status: 400 });

    const rows = await query<Writein>(
      `SELECT w.*, u.username FROM question_writeins w JOIN users u ON u.id = w.user_id
       WHERE w.id = $1 AND w.question_id = $2`,
      [writeinId, question.id]
    );
    const writein = rows[0];
    if (!writein) return NextResponse.json({ error: 'write-in not found' }, { status: 404 });
    if (writein.promoted_option_id) {
      return NextResponse.json({ error: 'this write-in is already an option' }, { status: 409 });
    }

    const options = await getOptions(question.id);
    if (options.length >= MAX_OPTIONS) {
      return NextResponse.json({ error: `a question can have at most ${MAX_OPTIONS} options` }, { status: 409 });
    }

    const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : writein.body.trim().slice(0, OPTION_MAX);
    if (label.length > OPTION_MAX) {
      return NextResponse.json({ error: `option labels must be ${OPTION_MAX} characters or less` }, { status: 400 });
    }
    if (options.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      return NextResponse.json({ error: 'an option with that label already exists' }, { status: 409 });
    }

    const position = Math.max(0, ...options.map((o) => o.position)) + 1;
    const inserted = await query<{ id: number }>(
      'INSERT INTO question_options (question_id, position, label) VALUES ($1, $2, $3) RETURNING id',
      [question.id, position, label]
    );
    await query('UPDATE question_writeins SET promoted_option_id = $2 WHERE id = $1', [writein.id, inserted[0].id]);

    const detail = await getQuestionDetail(question, null);
    return NextResponse.json({ ...detail, promoted: { writein_id: writein.id, option_id: inserted[0].id, position, label } }, { status: 201 });
  } catch (error) {
    console.error('Error promoting write-in:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
