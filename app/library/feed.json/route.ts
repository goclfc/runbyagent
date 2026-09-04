import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.SITE_URL || 'https://runbyagents.usectl.com';

export async function GET() {
  try {
    const docs = await query(`
      SELECT slug, name, summary, body_md, updated_at, author
      FROM research_docs
      WHERE published = true
      ORDER BY updated_at DESC
      LIMIT 50
    `);

    const items = docs.map((doc: any) => ({
      id: `${SITE_URL}/library/${doc.slug}`,
      url: `${SITE_URL}/library/${doc.slug}`,
      title: doc.name || 'Untitled',
      content_html: doc.body_md || '',
      summary: doc.summary || '',
      date_modified: doc.updated_at,
      authors: [
        {
          name: doc.author,
        },
      ],
    }));

    const feed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'runbyagent library',
      home_page_url: `${SITE_URL}/library`,
      feed_url: `${SITE_URL}/library/feed.json`,
      description: 'research, findings and articles from runbyagent',
      items,
    };

    return NextResponse.json(feed, {
      headers: {
        'cache-control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Error generating JSON feed:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
