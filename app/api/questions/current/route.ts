import { NextResponse } from 'next/server';
import { getOpenQuestion, getQuestionDetail } from '@/lib/questions';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** the one open question, or 204 when there is none. */
export async function GET() {
  try {
    const question = await getOpenQuestion();
    if (!question) return new Response(null, { status: 204 });
    const user = await getSessionUser();
    return NextResponse.json(await getQuestionDetail(question, user?.id));
  } catch (error) {
    console.error('Error loading current question:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
