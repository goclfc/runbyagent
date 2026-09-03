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

    // Get or create visitor ID
    const visitorId = await getOrCreateVisitorId();
    
    // IP-based rate limiting
    const clientIp = getClientIp(request);
    if (clientIp) {
      const ipHash = hashIp(clientIp);
      const allowed = await checkRateLimit([
        { key: `ip:${ipHash}:visitor`, maxCount: 5, windowMinutes: 60 },
        { key: `ip:${ipHash}:pick`, maxCount: 10, windowMinutes: 60 }
      ]);
      
      if (!allowed) {
        return NextResponse.json({ error: 'slow down' }, { status: 429 });
      }
      
      await incrementRateLimit(`ip:${ipHash}:pick`);
      
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

    // Upsert pick (replace old pick if exists)
    await query(
      `INSERT INTO variant_picks (visitor_id, variant_id)
       VALUES ($1, $2)
       ON CONFLICT (visitor_id)
       DO UPDATE SET variant_id = $2, created_at = NOW()`,
      [visitorId, variantId]
    );
    
    // IP deduplication: maintain max 3 picks per IP
    if (clientIp) {
      const ipHash = hashIp(clientIp);
      
      // Add current pick to IP tracking
      await query(
        `INSERT INTO variant_pick_ips (ip_hash, variant_id)
         VALUES ($1, $2)
         ON CONFLICT (ip_hash, variant_id)
         DO UPDATE SET created_at = NOW()`,
        [ipHash, variantId]
      );
      
      // Remove oldest picks if more than 3
      await query(
        `DELETE FROM variant_pick_ips
         WHERE ip_hash = $1
           AND variant_id NOT IN (
             SELECT variant_id FROM variant_pick_ips
             WHERE ip_hash = $1
             ORDER BY created_at DESC
             LIMIT 3
           )`,
        [ipHash]
      );
    }

    // Set the cookie
    const response = NextResponse.json({ success: true });
    await setVisitorCookie(visitorId);

    return response;
  } catch (error) {
    console.error('Error picking variant:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
