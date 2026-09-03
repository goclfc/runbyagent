import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getOrCreateVisitorId, setVisitorCookie } from '@/lib/visitor';
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

    // IP-based rate limiting
    const clientIp = getClientIp(request);
    if (clientIp) {
      const ipHash = hashIp(clientIp);
      const allowed = await checkRateLimit([
        { key: `ip:${ipHash}:rating`, maxCount: 30, windowMinutes: 60 }
      ]);
      
      if (!allowed) {
        return NextResponse.json({ error: 'slow down' }, { status: 429 });
      }
    }

    // Get or create visitor ID
    const { id: visitorId, isNew } = await getOrCreateVisitorId();
    
    // Check new visitor cap and increment if needed
    if (isNew && clientIp) {
      const ipHash = hashIp(clientIp);
      const visitorAllowed = await checkRateLimit([
        { key: `ip:${ipHash}:visitor`, maxCount: 5, windowMinutes: 60 }
      ]);
      
      if (!visitorAllowed) {
        return NextResponse.json({ error: 'slow down' }, { status: 429 });
      }
      
      await incrementRateLimit(`ip:${ipHash}:visitor`);
    }
    
    // Increment rating limit after checks pass
    if (clientIp) {
      const ipHash = hashIp(clientIp);
      await incrementRateLimit(`ip:${ipHash}:rating`);
    }

    // Get variant
    const variants = await query<{ id: number }>('SELECT id FROM variants WHERE slug = $1', [slug]);
    if (variants.length === 0) {
      return NextResponse.json({ error: 'variant not found' }, { status: 404 });
    }
    const variantId = variants[0].id;

    // Upsert rating (trust is computed at read time based on visitor age)
    await query(
      `INSERT INTO variant_ratings (variant_id, visitor_id, stars)
       VALUES ($1, $2, $3)
       ON CONFLICT (variant_id, visitor_id)
       DO UPDATE SET stars = $3, created_at = NOW()`,
      [variantId, visitorId, stars]
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
