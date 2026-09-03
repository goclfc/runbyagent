import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      slug,
      name,
      tagline,
      url,
      repo_url,
      idea_url,
      status,
      metrics_url,
      stripe_tag,
      screenshot_url,
      launched_at,
    } = body;

    if (!slug || !name) {
      return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
    }

    const result = await query(`
      INSERT INTO projects (
        slug, name, tagline, url, repo_url, idea_url, status, metrics_url, stripe_tag, screenshot_url, launched_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        tagline = COALESCE(EXCLUDED.tagline, projects.tagline),
        url = COALESCE(EXCLUDED.url, projects.url),
        repo_url = COALESCE(EXCLUDED.repo_url, projects.repo_url),
        idea_url = COALESCE(EXCLUDED.idea_url, projects.idea_url),
        status = COALESCE(EXCLUDED.status, projects.status),
        metrics_url = COALESCE(EXCLUDED.metrics_url, projects.metrics_url),
        stripe_tag = COALESCE(EXCLUDED.stripe_tag, projects.stripe_tag),
        screenshot_url = COALESCE(EXCLUDED.screenshot_url, projects.screenshot_url),
        launched_at = COALESCE(EXCLUDED.launched_at, projects.launched_at)
      RETURNING *
    `, [slug, name, tagline, url, repo_url, idea_url, status, metrics_url, stripe_tag, screenshot_url, launched_at]);

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error upserting project:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
