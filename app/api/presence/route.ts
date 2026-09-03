import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Get or create visitor ID
    const cookieStore = await cookies();
    let visitorId = cookieStore.get('rba_vid')?.value;
    
    if (!visitorId) {
      visitorId = crypto.randomUUID();
    }
    
    const now = new Date().toISOString();
    
    // Upsert presence
    await query(
      `INSERT INTO presence (visitor_id, last_seen)
       VALUES ($1, $2)
       ON CONFLICT (visitor_id)
       DO UPDATE SET last_seen = $2`,
      [visitorId, now]
    );
    
    // Clean up old presence records (older than 1 day)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await query(
      'DELETE FROM presence WHERE last_seen < $1',
      [oneDayAgo]
    );
    
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
    console.error('Error updating presence:', error);
    return NextResponse.json({ ok: true }); // Fail silently
  }
}

export async function GET() {
  try {
    // Count visitors seen in the last 90 seconds
    const ninetySecondsAgo = new Date(Date.now() - 90 * 1000).toISOString();
    
    const result = await query<{ count: string }>(
      'SELECT COUNT(DISTINCT visitor_id)::INTEGER as count FROM presence WHERE last_seen >= $1',
      [ninetySecondsAgo]
    );
    
    const online = parseInt(result[0]?.count || '0', 10);
    
    return NextResponse.json({ online });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json({ online: 0 });
  }
}
