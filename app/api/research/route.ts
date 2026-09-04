import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  return authHeader === expectedAuth;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await query(`
      SELECT 
        id,
        name,
        jsonb_array_length(lines) as count,
        created_at,
        source
      FROM research_docs
      ORDER BY created_at DESC
    `);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching research docs:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
