import { NextRequest, NextResponse } from 'next/server';
import { isCron } from '@/lib/admin';
import { getOpenQuestion, fetchXPoll, applyXPoll } from '@/lib/questions';

export const dynamic = 'force-dynamic';

/** hourly: pull x poll counts onto the open question. quiet no-op when nothing is open or no post is linked. */
async function run(request: NextRequest) {
  if (!isCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const question = await getOpenQuestion();
    if (!question) return NextResponse.json({ synced: false, reason: 'no open question' });
    if (!question.x_post_id) return NextResponse.json({ synced: false, reason: 'open question has no x post', question: question.slug });
    if (!process.env.X_BEARER_TOKEN) return NextResponse.json({ synced: false, reason: 'X_BEARER_TOKEN is not set', question: question.slug });

    const poll = await fetchXPoll(question.x_post_id);
    if (!poll) return NextResponse.json({ synced: false, reason: 'x post has no poll', question: question.slug });

    const applied = await applyXPoll(question.id, poll);
    return NextResponse.json({ synced: true, question: question.slug, ...applied, voting_status: poll.voting_status ?? null });
  } catch (error) {
    console.error('Error syncing questions from x:', error);
    const message = error instanceof Error ? error.message : 'internal server error';
    return NextResponse.json({ synced: false, error: message }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
