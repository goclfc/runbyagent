import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const results = await query<{
      slug: string;
      rating_count: number;
      trusted_rating_count: number;
      pick_count: number;
      comment_count: number;
      visitor_metadata_count: number;
    }>(`
      SELECT 
        v.slug,
        COUNT(DISTINCT vr.visitor_id)::int as rating_count,
        COUNT(DISTINCT CASE WHEN (vm.created_at IS NULL OR vm.created_at < NOW() - INTERVAL '60 seconds') THEN vr.visitor_id ELSE NULL END)::int as trusted_rating_count,
        COUNT(DISTINCT vp.visitor_id)::int as pick_count,
        COUNT(DISTINCT vc.id)::int as comment_count,
        COUNT(DISTINCT vm.visitor_id)::int as visitor_metadata_count
      FROM variants v
      LEFT JOIN variant_ratings vr ON v.id = vr.variant_id
      LEFT JOIN visitor_metadata vm ON vr.visitor_id = vm.visitor_id
      LEFT JOIN variant_picks vp ON v.id = vp.variant_id
      LEFT JOIN variant_comments vc ON v.id = vc.variant_id
      GROUP BY v.id, v.slug
      ORDER BY v.slug ASC
    `);

    return NextResponse.json({ variants: results });
  } catch (error) {
    console.error('error fetching audit data:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
