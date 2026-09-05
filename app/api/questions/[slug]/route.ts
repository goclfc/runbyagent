import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBySlug, getOptions, getReplies, getMyVote } from '@/lib/questions';
import { getVisitorId } from '@/lib/visitor';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const question = await getQuestionBySlug(slug);
    if (!question) {
      return NextResponse.json({ error: 'question not found' }, { status: 404 });
    }
    const visitorId = await getVisitorId();
    const [options, replies, my_vote] = await Promise.all([
      getOptions(question.id),
      getReplies(question.id),
      getMyVote(question.id, visitorId),
    ]);
    return NextResponse.json({ question, options, replies, my_vote });
  } catch (error) {
    console.error('Error loading question:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
