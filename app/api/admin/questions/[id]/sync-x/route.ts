import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { findQuestionByIdOrSlug, getResults, fetchXPoll, applyXPoll, XPollSnapshot } from '@/lib/questions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * pull poll counts from x onto the options. with no body it calls the x api (needs X_BEARER_TOKEN).
 * a body of `{ poll: { options: [{ position, label, votes }] } }` writes counts by hand, for when the api
 * is unreachable, the token is missing, or a test wants deterministic numbers.
 */
export async function POST(request: NextRequest, { params }: Params) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const question = await findQuestionByIdOrSlug(id);
    if (!question) return NextResponse.json({ error: 'question not found' }, { status: 404 });

    let manual: XPollSnapshot | null = null;
    const raw = await request.text();
    if (raw.trim()) {
      let body: { poll?: XPollSnapshot };
      try {
        body = JSON.parse(raw);
      } catch {
        return NextResponse.json({ error: 'body must be json' }, { status: 400 });
      }
      if (body.poll) {
        if (!Array.isArray(body.poll.options)) return NextResponse.json({ error: 'poll.options must be an array' }, { status: 400 });
        manual = {
          options: body.poll.options.map((o) => ({ position: Number(o.position), label: String(o.label ?? ''), votes: Number(o.votes) || 0 })),
          voting_status: body.poll.voting_status,
          end_datetime: body.poll.end_datetime,
        };
      }
    }

    let poll = manual;
    let source: 'manual' | 'x' = 'manual';
    if (!poll) {
      if (!question.x_post_id) {
        return NextResponse.json({ error: 'this question has no x post. set x_post_url first or send poll counts in the body.' }, { status: 400 });
      }
      source = 'x';
      poll = await fetchXPoll(question.x_post_id);
      if (!poll) {
        return NextResponse.json({ error: 'the x post has no poll attached' }, { status: 422 });
      }
    }

    const applied = await applyXPoll(question.id, poll);
    const results = await getResults(question.id);
    return NextResponse.json({ source, ...applied, voting_status: poll.voting_status ?? null, results });
  } catch (error) {
    console.error('Error syncing x poll:', error);
    const message = error instanceof Error ? error.message : 'internal server error';
    const status = /X_BEARER_TOKEN/.test(message) ? 503 : /x api returned/.test(message) ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
