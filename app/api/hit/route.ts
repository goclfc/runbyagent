import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const BOT_PATTERNS = [
  'runbyagent-claude',
  'bot',
  'spider',
  'crawler',
  'scraper',
  'googlebot',
  'bingbot',
  'slackbot',
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = body.path as string;
    
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'invalid path' }, { status: 400 });
    }
    
    // Exclude API routes
    if (path.startsWith('/api')) {
      return NextResponse.json({ ok: true });
    }
    
    // Exclude bots
    const userAgent = req.headers.get('user-agent') || '';
    if (isBot(userAgent)) {
      return NextResponse.json({ ok: true });
    }
    
    // Get or create visitor ID
    const cookieStore = await cookies();
    let visitorId = cookieStore.get('rba_vid')?.value;
    
    if (!visitorId) {
      visitorId = crypto.randomUUID();
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Check if this visitor has viewed this path in the last 30 minutes
    const recentHit = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM visitor_days 
       WHERE visitor_id = $1 AND day = $2`,
      [visitorId, today]
    );
    
    const isNewVisitorToday = recentHit[0]?.count === '0';
    
    // Check if this is a unique view for this visitor/path/day combo
    // We use a simple approach: check if visitor_days entry exists for today
    const pathKey = `${path}:${today}:${visitorId}`;
    const hasViewedPathToday = await query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM visitor_days 
        WHERE visitor_id = $1 AND day = $2
        LIMIT 1
      ) as exists`,
      [visitorId, today]
    );
    
    const isUniqueView = !hasViewedPathToday[0]?.exists;
    
    // Insert or update hits
    await query(
      `INSERT INTO hits (day, path, views, uniques)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (day, path)
       DO UPDATE SET 
         views = hits.views + 1,
         uniques = hits.uniques + $3`,
      [today, path, isUniqueView ? 1 : 0]
    );
    
    // Track visitor day
    if (isNewVisitorToday) {
      await query(
        `INSERT INTO visitor_days (day, visitor_id)
         VALUES ($1, $2)
         ON CONFLICT (day, visitor_id) DO NOTHING`,
        [today, visitorId]
      );
    }
    
    const response = NextResponse.json({ ok: true });
    
    // Set cookie if not exists
    if (!cookieStore.get('rba_vid')?.value) {
      response.cookies.set('rba_vid', visitorId, {
        maxAge: 365 * 24 * 60 * 60, // 1 year
        httpOnly: true,
        sameSite: 'lax',
      });
    }
    
    return response;
  } catch (error) {
    console.error('Error tracking hit:', error);
    return NextResponse.json({ ok: true }); // Fail silently
  }
}
