import { NextResponse } from 'next/server';
import { getOpenQuestion, getOptions, getReplies, getMyVote } from '@/lib/questions';
import { getVisitorId } from '@/lib/visitor';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const question = await getOpenQuestion();
    if (!question) {
      return NextResponse.json({ question: null });
    }
    const visitorId = await getVisitorId();
    const [options, replies, my_vote] = await Promise.all([
      getOptions(question.id),
      getReplies(question.id),
      getMyVote(question.id, visitorId),
    ]);
    return NextResponse.json({ question, options, replies, my_vote });
  } catch (error) {
    console.error('Error loading open question:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
