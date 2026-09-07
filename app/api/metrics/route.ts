import { NextResponse } from 'next/server';
import { getMetrics } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

/** the platform totals plus one row per project. the sunday numbers post reads this alone. */
export async function GET() {
  try {
    return NextResponse.json(await getMetrics());
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
