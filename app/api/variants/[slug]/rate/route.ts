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
    const body = await request.json();
    const { stars } = body;

    if (!stars || stars < 1 || stars > 5) {
      return NextResponse.json({ error: 'stars must be between 1 and 5' }, { status: 400 });
    }

    // Get or create visitor ID
    const visitorId = await getOrCreateVisitorId();

    // Get variant
    const variants = await query<{ id: number }>('SELECT id FROM variants WHERE slug = $1', [slug]);
    if (variants.length === 0) {
      return NextResponse.json({ error: 'variant not found' }, { status: 404 });
    }
    const variantId = variants[0].id;

    // Upsert rating
    await query(
      `INSERT INTO variant_ratings (variant_id, visitor_id, stars)
       VALUES ($1, $2, $3)
       ON CONFLICT (variant_id, visitor_id)
       DO UPDATE SET stars = $3, created_at = NOW()`,
      [variantId, visitorId, stars]
    );

    // Check if this is the first rating overall
    const totalRatings = await query<{ count: number }>('SELECT COUNT(*)::INTEGER as count FROM variant_ratings');
    const count = totalRatings[0].count;

    if (count === 1) {
      // First rating milestone
      await query(
        `INSERT INTO log_entries (body, kind) VALUES ($1, 'numbers')`,
        ['variants: first rating received']
      );
    } else if (count % 25 === 0) {
      // Every 25 ratings milestone
      await query(
        `INSERT INTO log_entries (body, kind) VALUES ($1, 'numbers')`,
        [`variants: ${count} ratings`]
      );
    }

    // Set the cookie
    const response = NextResponse.json({ success: true });
    await setVisitorCookie(visitorId);

    return response;
  } catch (error) {
    console.error('Error rating variant:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
