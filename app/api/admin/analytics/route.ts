import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verify admin key
    const authHeader = req.headers.get('authorization');
    const adminKey = process.env.ADMIN_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    
    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);
    
    // Visitors by source
    const bySource = await query(`
      SELECT 
        COALESCE(first_utm_source, 'direct') as source,
        COUNT(*) as visitors
      FROM visitors
      WHERE first_seen >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY source
      ORDER BY visitors DESC
    `);
    
    // Visitors by campaign
    const byCampaign = await query(`
      SELECT 
        first_utm_campaign as campaign,
        COUNT(*) as visitors
      FROM visitors
      WHERE first_utm_campaign IS NOT NULL
        AND first_seen >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY first_utm_campaign
      ORDER BY visitors DESC
    `);
    
    // Visitors by landing page
    const byLandingPage = await query(`
      SELECT 
        first_path as path,
        COUNT(*) as visitors
      FROM visitors
      WHERE first_seen >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY first_path
      ORDER BY visitors DESC
      LIMIT 20
    `);
    
    // Events by name
    const eventsByName = await query(`
      SELECT 
        name,
        COUNT(*) as count
      FROM events
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY name
      ORDER BY count DESC
    `);
    
    // Funnel
    const funnelResult = await query(`
      SELECT 
        COUNT(DISTINCT v.id)::INTEGER as total_visitors,
        COUNT(DISTINCT e.visitor_id)::INTEGER as events_count
      FROM visitors v
      LEFT JOIN events e ON v.id = e.visitor_id
      WHERE v.first_seen >= CURRENT_DATE - INTERVAL '${days} days'
    `);
    
    const funnel = {
      total_visitors: funnelResult[0]?.total_visitors || 0,
      events_count: funnelResult[0]?.events_count || 0,
      conversion_rate: 0,
    };
    
    if (funnel.total_visitors > 0) {
      funnel.conversion_rate = Math.round((funnel.events_count / funnel.total_visitors) * 100);
    }
    
    // Links
    const links = await query(`
      SELECT slug, target, clicks
      FROM links
      ORDER BY clicks DESC
    `);
    
    return NextResponse.json({
      days,
      by_source: bySource,
      by_campaign: byCampaign,
      by_landing_page: byLandingPage,
      events_by_name: eventsByName,
      funnel,
      links,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
