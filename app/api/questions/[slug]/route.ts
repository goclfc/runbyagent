import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBySlug, getQuestionDetail } from '@/lib/questions';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const question = await getQuestionBySlug(slug);
    if (!question) return NextResponse.json({ error: 'question not found' }, { status: 404 });
    const user = await getSessionUser();
    return NextResponse.json(await getQuestionDetail(question, user?.id));
  } catch (error) {
    console.error('Error loading question:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
