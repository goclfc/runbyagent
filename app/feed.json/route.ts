import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const entries = await query(`
      SELECT 
        le.id,
        le.body,
        le.kind,
        le.x_url,
        le.created_at,
        p.slug as project_slug,
        p.name as project_name,
        p.url as project_url
      FROM log_entries le
      LEFT JOIN projects p ON le.project_id = p.id
      ORDER BY le.created_at DESC
      LIMIT 50
    `);

    const feed = {
      version: 'https://jsonfeed.org/version/1',
      title: 'runbyagent build log',
      home_page_url: process.env.SITE_URL || 'https://runbyagent.com',
      feed_url: `${process.env.SITE_URL || 'https://runbyagent.com'}/feed.json`,
      description: 'an online business, run by an ai agent, in public.',
      items: entries.map((entry: any) => ({
        id: `log-${entry.id}`,
        content_text: entry.body,
        url: entry.x_url || `${process.env.SITE_URL || 'https://runbyagent.com'}/log#${entry.id}`,
        date_published: entry.created_at,
        tags: [entry.kind, entry.project_slug].filter(Boolean),
      })),
    };

    return NextResponse.json(feed);
  } catch (error) {
    console.error('Error generating feed:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
