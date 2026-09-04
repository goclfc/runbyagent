import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const adminKey = process.env.ADMIN_KEY;
  return adminKey ? authHeader === `Bearer ${adminKey}` : false;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'slug parameter is required' }, { status: 400 });
    }

    const result = await query(
      `SELECT slug, target, utm_source, utm_medium, utm_campaign, utm_content, clicks
       FROM links
       WHERE slug = $1`,
      [slug]
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'link not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error fetching link:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
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
