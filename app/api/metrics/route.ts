import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await query(`
      SELECT 
        COUNT(DISTINCT p.id)::INTEGER as projects_total,
        COUNT(DISTINCT CASE WHEN p.status = 'live' THEN p.id END)::INTEGER as projects_live,
        COALESCE(SUM(rd.cents), 0)::INTEGER as revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::INTEGER as revenue_30d
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
    `);

    return NextResponse.json(result[0] || {
      projects_total: 0,
      projects_live: 0,
      revenue_all_time: 0,
      revenue_30d: 0,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
