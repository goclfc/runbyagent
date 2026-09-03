import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function fill30Days(data: { day: string; cents?: number; count?: number }[]): any[] {
  const result: any[] = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().split('T')[0];
    const found = data.find(d => d.day === dayStr);
    result.push({
      day: dayStr,
      revenue_cents: found?.cents ?? 0,
      page_views: 0,
      unique_visitors: 0,
    });
  }
  
  return result;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 30;
  
  if (isNaN(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: 'days must be between 1 and 365' }, { status: 400 });
  }

  try {
    const revenueDays = await query(`
      SELECT 
        day,
        SUM(cents)::INTEGER as cents
      FROM revenue_daily
      WHERE day >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY day
      ORDER BY day ASC
    `);

    const viewsDays = await query(`
      SELECT 
        day,
        SUM(views)::INTEGER as count
      FROM hits
      WHERE day >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY day
      ORDER BY day ASC
    `);

    const uniquesDays = await query(`
      SELECT 
        day,
        COUNT(DISTINCT visitor_id)::INTEGER as count
      FROM visitor_days
      WHERE day >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY day
      ORDER BY day ASC
    `);

    const result = fill30Days(revenueDays);
    
    for (const day of result) {
      const viewsData = viewsDays.find((v: any) => v.day === day.day);
      const uniquesData = uniquesDays.find((u: any) => u.day === day.day);
      
      day.page_views = viewsData?.count ?? 0;
      day.unique_visitors = uniquesData?.count ?? 0;
    }

    return NextResponse.json({
      days: days,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching daily analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
