import { NextResponse } from 'next/server';
import { listQuestions } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const questions = await listQuestions();
    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error listing questions:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
