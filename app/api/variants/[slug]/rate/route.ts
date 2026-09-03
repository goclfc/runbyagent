import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getOrCreateVisitorId, setVisitorCookie, getVisitorMetadata } from '@/lib/visitor';
import { hashIp, getClientIp, checkRateLimit, incrementRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { stars } = body;

    if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      return NextResponse.json({ error: 'stars must be between 1 and 5' }, { status: 400 });
    }

    // Get or create visitor ID
    const visitorId = await getOrCreateVisitorId();
    
    // IP-based rate limiting
    const clientIp = getClientIp(request);
    if (clientIp) {
      const ipHash = hashIp(clientIp);
      const allowed = await checkRateLimit([
        { key: `ip:${ipHash}:visitor`, maxCount: 5, windowMinutes: 60 },
        { key: `ip:${ipHash}:rating`, maxCount: 30, windowMinutes: 60 }
      ]);
      
      if (!allowed) {
        return NextResponse.json({ error: 'slow down' }, { status: 429 });
      }
      
      await incrementRateLimit(`ip:${ipHash}:rating`);
      
      // Track visitor creation from this IP
      const visitorMeta = await getVisitorMetadata(visitorId);
      if (!visitorMeta) {
        await incrementRateLimit(`ip:${ipHash}:visitor`);
      }
    }

    // Get variant
    const variants = await query<{ id: number }>('SELECT id FROM variants WHERE slug = $1', [slug]);
    if (variants.length === 0) {
      return NextResponse.json({ error: 'variant not found' }, { status: 404 });
    }
    const variantId = variants[0].id;

    // Determine if rating should be trusted
    const visitorMeta = await getVisitorMetadata(visitorId);
    const trusted = visitorMeta && (
      (Date.now() - visitorMeta.created_at.getTime() > 10000) || 
      visitorMeta.page_views >= 2
    );

    // Upsert rating
    await query(
      `INSERT INTO variant_ratings (variant_id, visitor_id, stars, trusted)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (variant_id, visitor_id)
       DO UPDATE SET stars = $3, trusted = $4, created_at = NOW()`,
      [variantId, visitorId, stars, trusted]
    );

    // Check if this is the first rating overall
    const totalRatings = await query<{ count: number }>('SELECT COUNT(*)::int as count FROM variant_ratings');
    const count = totalRatings[0].count;

    if (count === 1) {
      // First rating milestone
      const existing = await query('SELECT id FROM log_entries WHERE body = $1', ['variants: first rating received']);
      if (existing.length === 0) {
        await query(
          `INSERT INTO log_entries (body, kind) VALUES ($1, 'numbers')`,
          ['variants: first rating received']
        );
      }
    } else if (count % 25 === 0) {
      // Every 25 ratings milestone
      const milestoneBody = `variants: ${count} ratings`;
      const existing = await query('SELECT id FROM log_entries WHERE body = $1', [milestoneBody]);
      if (existing.length === 0) {
        await query(
          `INSERT INTO log_entries (body, kind) VALUES ($1, 'numbers')`,
          [milestoneBody]
        );
      }
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
