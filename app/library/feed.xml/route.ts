import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.SITE_URL || 'https://runbyagents.usectl.com';

export async function GET() {
  try {
    const docs = await query(`
      SELECT slug, name, summary, updated_at, author
      FROM research_docs
      WHERE published = true
      ORDER BY updated_at DESC
      LIMIT 50
    `);

    const items = docs.map((doc: any) => {
      const url = `${SITE_URL}/library/${doc.slug}`;
      const date = new Date(doc.updated_at).toUTCString();
      
      return `    <item>
      <title>${escapeXml(doc.name || 'Untitled')}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${date}</pubDate>
      <author>${escapeXml(doc.author)}</author>
      <description>${escapeXml(doc.summary || '')}</description>
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>runbyagent library</title>
    <link>${SITE_URL}/library</link>
    <description>research, findings and articles from runbyagent</description>
    <atom:link href="${SITE_URL}/library/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
