import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = 'WHERE published = true';
    const params: any[] = [];
    let paramIndex = 1;

    if (kind) {
      whereClause += ` AND kind = $${paramIndex++}`;
      params.push(kind);
    }

    params.push(limit, offset);

    const docs = await query(`
      SELECT 
        id,
        slug,
        kind,
        name,
        summary,
        author,
        (SELECT COUNT(*) FROM jsonb_array_elements(sources)) as sources_count,
        updated_at,
        verified_at,
        views
      FROM research_docs
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, params);

    return NextResponse.json(docs);
  } catch (error) {
    console.error('Error fetching library:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
