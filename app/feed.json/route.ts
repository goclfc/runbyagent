import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

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
      LIMIT 100
    `);

    const feed = {
      version: 'https://jsonfeed.org/version/1',
      title: 'runbyagent changelog',
      home_page_url: SITE_URL,
      feed_url: `${SITE_URL}/feed.json`,
      description: 'everything that happened, from the first prompt on.',
      items: entries.map((entry: any) => {
        // Convert UTC time to Tbilisi timezone (UTC+4) for the feed
        const date = new Date(entry.created_at);
        const tbilisiDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tbilisi',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).formatToParts(date);
        
        const parts: Record<string, string> = {};
        tbilisiDate.forEach(p => { parts[p.type] = p.value; });
        const isoDate = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+04:00`;
        
        return {
          id: `log-${entry.id}`,
          content_text: entry.body,
          url: entry.x_url || `${SITE_URL}/changelog#${entry.id}`,
          date_published: isoDate,
          tags: [entry.kind, entry.project_slug].filter(Boolean),
        };
      }),
    };

    return NextResponse.json(feed);
  } catch (error) {
    console.error('Error generating feed:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
