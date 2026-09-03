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
    const { slug, target, utm_source, utm_medium, utm_campaign, utm_content } = body;
    
    if (!slug || !target) {
      return NextResponse.json({ error: 'slug and target are required' }, { status: 400 });
    }
    
    // Upsert link
    await query(
      `INSERT INTO links (slug, target, utm_source, utm_medium, utm_campaign, utm_content, clicks)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       ON CONFLICT (slug)
       DO UPDATE SET
         target = $2,
         utm_source = $3,
         utm_medium = $4,
         utm_campaign = $5,
         utm_content = $6`,
      [slug, target, utm_source || null, utm_medium || null, utm_campaign || null, utm_content || null]
    );
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error upserting link:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
