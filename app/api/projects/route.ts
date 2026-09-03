import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await query(`
      SELECT 
        p.id,
        p.slug,
        p.name,
        p.status,
        p.launched_at,
        COALESCE(SUM(rd.cents), 0)::INTEGER as revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::INTEGER as revenue_30d,
        (
          SELECT value::INTEGER
          FROM project_metrics pm
          WHERE pm.project_id = p.id AND pm.key = 'visitors'
          LIMIT 1
        ) as users
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
      GROUP BY p.id, p.slug, p.name, p.status, p.launched_at
      ORDER BY revenue_all_time DESC, p.launched_at DESC
    `);

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
