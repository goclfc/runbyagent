import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  return authHeader === expectedAuth;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const docId = parseInt(id);
    if (isNaN(docId)) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }

    const result = await query(`
      SELECT id, name, lines, meta, source, created_at
      FROM research_docs
      WHERE id = $1
    `, [docId]);

    if (result.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const doc = result[0];
    
    return NextResponse.json({
      id: doc.id,
      name: doc.name,
      lines: doc.lines,
      meta: doc.meta,
      source: doc.source,
      created_at: doc.created_at,
    });
  } catch (error) {
    console.error('Error fetching research doc:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
