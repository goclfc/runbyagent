import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getOrCreateVisitorId, setVisitorCookie } from '@/lib/visitor';

export const dynamic = 'force-dynamic';

// Rate limit store (in-memory, per visitor)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(visitorId: string): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(visitorId);

  if (!limit || now > limit.resetAt) {
    // Reset the limit every hour
    rateLimitStore.set(visitorId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (limit.count >= 10) {
    return false;
  }

  limit.count++;
  return true;
}

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
    const { name, body: commentBody } = body;

    if (!commentBody || typeof commentBody !== 'string' || commentBody.trim().length === 0) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }

    if (commentBody.length > 2000) {
      return NextResponse.json({ error: 'body must be 2000 characters or less' }, { status: 400 });
    }

    // Get or create visitor ID
    const visitorId = await getOrCreateVisitorId();

    // Check rate limit
    if (!checkRateLimit(visitorId)) {
      return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429 });
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

    // Check for milestone
    const totalComments = await query<{ count: number }>('SELECT COUNT(*)::INTEGER as count FROM variant_comments');
    const count = totalComments[0].count;

    if (count % 10 === 0) {
      await query(
        `INSERT INTO log_entries (body, kind) VALUES ($1, 'numbers')`,
        [`variants: ${count} comments`]
      );
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
