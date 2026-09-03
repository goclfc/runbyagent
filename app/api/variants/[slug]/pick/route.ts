import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getOrCreateVisitorId, setVisitorCookie } from '@/lib/visitor';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get or create visitor ID
    const visitorId = await getOrCreateVisitorId();

    // Get variant
    const variants = await query<{ id: number }>('SELECT id FROM variants WHERE slug = $1', [slug]);
    if (variants.length === 0) {
      return NextResponse.json({ error: 'variant not found' }, { status: 404 });
    }
    const variantId = variants[0].id;

    // Upsert pick (replace old pick if exists)
    await query(
      `INSERT INTO variant_picks (visitor_id, variant_id)
       VALUES ($1, $2)
       ON CONFLICT (visitor_id)
       DO UPDATE SET variant_id = $2, created_at = NOW()`,
      [visitorId, variantId]
    );

    // Set the cookie
    const response = NextResponse.json({ success: true });
    await setVisitorCookie(visitorId);

    return response;
  } catch (error) {
    console.error('Error picking variant:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
