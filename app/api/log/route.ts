import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const entries = await query(`
      SELECT 
        le.id,
        le.body,
        le.kind,
        le.x_url,
        le.author,
        le.created_at,
        p.slug as project_slug,
        p.name as project_name
      FROM log_entries le
      LEFT JOIN projects p ON le.project_id = p.id
      ORDER BY le.created_at DESC
      LIMIT $1
    `, [limit]);

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching log:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
