import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    
    // Look up link
    const result = await query<{
      target: string;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      utm_content: string | null;
    }>(
      'SELECT target, utm_source, utm_medium, utm_campaign, utm_content FROM links WHERE slug = $1',
      [slug]
    );
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    
    const link = result[0];
    
    // Increment click count
    await query(
      'UPDATE links SET clicks = clicks + 1 WHERE slug = $1',
      [slug]
    );
    
    // Build target URL with utm params
    const targetUrl = new URL(link.target);
    if (link.utm_source) {
      targetUrl.searchParams.set('utm_source', link.utm_source);
    }
    if (link.utm_medium) {
      targetUrl.searchParams.set('utm_medium', link.utm_medium);
    }
    if (link.utm_campaign) {
      targetUrl.searchParams.set('utm_campaign', link.utm_campaign);
    }
    if (link.utm_content) {
      targetUrl.searchParams.set('utm_content', link.utm_content);
    }
    
    return NextResponse.redirect(targetUrl.toString(), { status: 302 });
  } catch (error) {
    console.error('Error redirecting link:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
