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

    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN h.day = $1 THEN h.views ELSE 0 END), 0)::INTEGER as views_today,
        COALESCE(SUM(h.views), 0)::INTEGER as views_total,
        COALESCE(COUNT(DISTINCT CASE WHEN vd.day = $1 THEN vd.visitor_id END), 0)::INTEGER as uniques_today,
        COALESCE(COUNT(DISTINCT vd.visitor_id), 0)::INTEGER as uniques_total
      FROM hits h
      FULL OUTER JOIN visitor_days vd ON 1=1
    `, [today]);

    const onlineResult = await query<{ count: string }>(`
      SELECT COUNT(DISTINCT visitor_id)::INTEGER as count 
      FROM presence 
      WHERE last_seen >= NOW() - INTERVAL '90 seconds'
    `);

    return NextResponse.json({
      ...(result[0] || {
        projects_total: 0,
        projects_live: 0,
        revenue_all_time: 0,
        revenue_30d: 0,
      }),
      ...(analyticsResult[0] || {
        views_today: 0,
        views_total: 0,
        uniques_today: 0,
        uniques_total: 0,
      }),
      online: parseInt(onlineResult[0]?.count || '0', 10),
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
