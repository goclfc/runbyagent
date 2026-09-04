import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/karma';

export const dynamic = 'force-dynamic';

// public read-only data: other projects (painboard) read it from the browser
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** public: users ranked by karma. ?limit=50 (max 200) */
export async function GET(request: NextRequest) {
  try {
    const raw = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 200) : 50;
    const users = await getLeaderboard(limit);
    return NextResponse.json({ users }, { headers: CORS });
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
