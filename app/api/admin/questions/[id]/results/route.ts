import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { findQuestionByIdOrSlug, getResults, getWriteins } from '@/lib/questions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const question = await findQuestionByIdOrSlug(id);
  if (!question) return NextResponse.json({ error: 'question not found' }, { status: 404 });
  const [results, writeins] = await Promise.all([getResults(question.id), getWriteins(question.id)]);
  return NextResponse.json({
    question: { id: question.id, slug: question.slug, title: question.title, status: question.status, closes_at: question.closes_at, x_synced_at: question.x_synced_at },
    ...results,
    writeins,
  });
}
