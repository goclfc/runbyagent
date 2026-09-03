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

function getDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }
  return 'desktop';
}

function normalizeReferrer(referrer: string, utmSource?: string): string {
  if (utmSource) {
    return utmSource;
  }
  
  if (!referrer) {
    return 'direct';
  }
  
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    
    // Normalize common sources
    if (host === 't.co' || host === 'x.com' || host === 'twitter.com' || host.includes('x.com') || host.includes('twitter.com')) {
      return 'x';
    }
    if (host.startsWith('google.') || host.includes('google.')) {
      return 'google';
    }
    if (host === 'news.ycombinator.com') {
      return 'hn';
    }
    if (host === 'reddit.com' || host.endsWith('.reddit.com')) {
      return 'reddit';
    }
    
    return host;
  } catch {
    return 'direct';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = body.path as string;
    const referrer = body.referrer as string | undefined;
    const utmSource = body.utm_source as string | undefined;
    const utmMedium = body.utm_medium as string | undefined;
    const utmCampaign = body.utm_campaign as string | undefined;
    const utmContent = body.utm_content as string | undefined;
    
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
    
    const isNewVisitor = !visitorId;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
    }
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    // Capture first-touch attribution for new visitors
    if (isNewVisitor) {
      const device = getDevice(userAgent);
      const country = req.headers.get('cf-ipcountry') || req.headers.get('x-country') || null;
      
      await query(
        `INSERT INTO visitors (id, first_seen, first_path, first_referrer, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, country, device)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [visitorId, now, path, referrer || null, utmSource || null, utmMedium || null, utmCampaign || null, utmContent || null, country, device]
      );
    }
    
    // Normalize referrer for source tracking
    const referrerHost = normalizeReferrer(referrer || '', utmSource);
    
    // Check if this visitor has viewed this path today
    const recentHit = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM visitor_days 
       WHERE visitor_id = $1 AND day = $2`,
      [visitorId, today]
    );
    
    const isNewVisitorToday = recentHit[0]?.count === '0';
    
    // Check if this is a unique view for this visitor/path/day combo
    const hasViewedPathToday = await query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM visitor_days 
        WHERE visitor_id = $1 AND day = $2
        LIMIT 1
      ) as exists`,
      [visitorId, today]
    );
    
    const isUniqueView = !hasViewedPathToday[0]?.exists;
    
    // Insert or update hits with referrer and utm params
    await query(
      `INSERT INTO hits (day, path, views, uniques, referrer_host, utm_source, utm_medium, utm_campaign, utm_content)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (day, path)
       DO UPDATE SET 
         views = hits.views + 1,
         uniques = hits.uniques + $3`,
      [today, path, isUniqueView ? 1 : 0, referrerHost !== 'direct' ? referrerHost : null, utmSource || null, utmMedium || null, utmCampaign || null, utmContent || null]
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
