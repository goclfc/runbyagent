import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { slug, confirm } = body;

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    const expectedConfirm = `reset-${slug}`;
    if (confirm !== expectedConfirm) {
      return NextResponse.json({ 
        error: 'confirmation required', 
        expected: expectedConfirm 
      }, { status: 400 });
    }

    // Get variant ID
    const variants = await query<{ id: number }>('SELECT id FROM variants WHERE slug = $1', [slug]);
    if (variants.length === 0) {
      return NextResponse.json({ error: 'variant not found' }, { status: 404 });
    }
    const variantId = variants[0].id;

    // Delete all ratings, picks, and comments for this variant
    await query('DELETE FROM variant_ratings WHERE variant_id = $1', [variantId]);
    await query('DELETE FROM variant_picks WHERE variant_id = $1', [variantId]);
    await query('DELETE FROM variant_comments WHERE variant_id = $1', [variantId]);
    await query('DELETE FROM variant_pick_ips WHERE variant_id = $1', [variantId]);

    // Log the reset as a changelog entry
    await query(
      `INSERT INTO log_entries (kind, message, created_at) VALUES ('fix', $1, NOW())`,
      [`admin reset variant ${slug} (all ratings, picks, comments deleted)`]
    );

    return NextResponse.json({ success: true, slug, reset: true });
  } catch (error) {
    console.error('Error resetting variant:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
