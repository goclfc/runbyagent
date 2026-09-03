import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getOrCreateVisitorId, setVisitorCookie, getVisitorMetadata } from '@/lib/visitor';
import { hashIp, getClientIp, checkRateLimit, incrementRateLimit, verifyDwellTimeToken } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get variant
    const variants = await query<{ id: number }>('SELECT id FROM variants WHERE slug = $1', [slug]);
    if (variants.length === 0) {
      return NextResponse.json({ error: 'variant not found' }, { status: 404 });
    }
    const variantId = variants[0].id;

    // Get comments
    const comments = await query(
      `SELECT id, name, body, created_at
       FROM variant_comments
       WHERE variant_id = $1
       ORDER BY created_at DESC`,
      [variantId]
    );

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { name, body: commentBody, website, t0 } = body;
    
    // Honeypot check: if website field is filled, silently discard
    if (website && website.trim().length > 0) {
      return NextResponse.json({ success: true, id: 0 });
    }
    
    // Dwell time check
    if (t0) {
      if (!verifyDwellTimeToken(t0, 3)) {
        return NextResponse.json({ error: 'slow down' }, { status: 429 });
      }
    }

    if (!commentBody || typeof commentBody !== 'string' || commentBody.trim().length === 0) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }

    if (commentBody.length > 2000) {
      return NextResponse.json({ error: 'body must be 2000 characters or less' }, { status: 400 });
    }

    // Get or create visitor ID
    const visitorId = await getOrCreateVisitorId();
    
    // IP-based rate limiting
    const clientIp = getClientIp(request);
    if (clientIp) {
      const ipHash = hashIp(clientIp);
      const allowed = await checkRateLimit([
        { key: `ip:${ipHash}:visitor`, maxCount: 5, windowMinutes: 60 },
        { key: `ip:${ipHash}:comment`, maxCount: 5, windowMinutes: 60 },
        { key: `ip:${ipHash}:comment_daily`, maxCount: 20, windowMinutes: 1440 }
      ]);
      
      if (!allowed) {
        return NextResponse.json({ error: 'slow down' }, { status: 429 });
      }
      
      // Track visitor creation from this IP
      const visitorMeta = await getVisitorMetadata(visitorId);
      if (!visitorMeta) {
        await incrementRateLimit(`ip:${ipHash}:visitor`);
      }
    }
    
    // Per-visitor rate limiting (10 per hour)
    const visitorAllowed = await checkRateLimit([
      { key: `visitor:${visitorId}:comment`, maxCount: 10, windowMinutes: 60 }
    ]);
    
    if (!visitorAllowed) {
      return NextResponse.json({ error: 'slow down' }, { status: 429 });
    }

    // Get variant
    const variants = await query<{ id: number }>('SELECT id FROM variants WHERE slug = $1', [slug]);
    if (variants.length === 0) {
      return NextResponse.json({ error: 'variant not found' }, { status: 404 });
    }
    const variantId = variants[0].id;

    // Insert comment
    const result = await query<{ id: number }>(
      `INSERT INTO variant_comments (variant_id, visitor_id, name, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [variantId, visitorId, name || null, commentBody.trim()]
    );
    
    // Increment rate limits after successful insert
    if (clientIp) {
      const ipHash = hashIp(clientIp);
      await incrementRateLimit(`ip:${ipHash}:comment`);
      await incrementRateLimit(`ip:${ipHash}:comment_daily`);
    }
    await incrementRateLimit(`visitor:${visitorId}:comment`);

    // Check for milestone
    const totalComments = await query<{ count: number }>('SELECT COUNT(*)::int as count FROM variant_comments');
    const count = totalComments[0].count;

    if (count % 10 === 0) {
      const milestoneBody = `variants: ${count} comments`;
      const existing = await query('SELECT id FROM log_entries WHERE body = $1', [milestoneBody]);
      if (existing.length === 0) {
        await query(
          `INSERT INTO log_entries (body, kind) VALUES ($1, 'numbers')`,
          [milestoneBody]
        );
      }
    }

    // Set the cookie
    const response = NextResponse.json({ success: true, id: result[0].id });
    await setVisitorCookie(visitorId);

    return response;
  } catch (error) {
    console.error('Error posting comment:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
