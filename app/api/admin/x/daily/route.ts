import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify admin key
    const authHeader = req.headers.get('authorization');
    const adminKey = process.env.ADMIN_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { day, followers, following, posts, impressions, profile_visits, engagements, notes } = body;
    
    if (!day) {
      return NextResponse.json({ error: 'day is required' }, { status: 400 });
    }
    
    // Upsert X daily metrics
    await query(
      `INSERT INTO x_daily (day, followers, following, posts, impressions, profile_visits, engagements, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (day)
       DO UPDATE SET
         followers = COALESCE($2, x_daily.followers),
         following = COALESCE($3, x_daily.following),
         posts = COALESCE($4, x_daily.posts),
         impressions = COALESCE($5, x_daily.impressions),
         profile_visits = COALESCE($6, x_daily.profile_visits),
         engagements = COALESCE($7, x_daily.engagements),
         notes = COALESCE($8, x_daily.notes)`,
      [day, followers, following, posts, impressions, profile_visits, engagements, notes]
    );
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error upserting X daily metrics:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
