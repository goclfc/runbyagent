import { NextResponse } from 'next/server';
import { listQuestions } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const questions = await listQuestions();
    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        slug: q.slug,
        title: q.title,
        status: q.status,
        opened_at: q.opened_at,
        closes_at: q.closes_at,
        decided_at: q.decided_at,
        x_post_url: q.x_post_url,
        site_votes: q.site_votes,
        x_votes: q.x_votes,
        total_votes: q.site_votes + q.x_votes,
        writein_count: q.writein_count,
        decision_log_id: q.decision_log_id,
      })),
    });
  } catch (error) {
    console.error('Error listing questions:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
