import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ALLOWED_EVENTS = [
  'click_x',
  'click_painboard',
  'click_leaderboard',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.name as string;
    const path = body.path as string;
    const meta = body.meta || null;
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'invalid name' }, { status: 400 });
    }
    
    if (!ALLOWED_EVENTS.includes(name)) {
      return NextResponse.json({ error: 'invalid event name' }, { status: 400 });
    }
    
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'invalid path' }, { status: 400 });
    }
    
    // Get visitor ID
    const cookieStore = await cookies();
    const visitorId = cookieStore.get('rba_vid')?.value;
    
    if (!visitorId) {
      // No visitor tracking yet, skip event
      return NextResponse.json({ ok: true });
    }
    
    // Record event
    await query(
      `INSERT INTO events (visitor_id, name, path, meta)
       VALUES ($1, $2, $3, $4)`,
      [visitorId, name, path, meta ? JSON.stringify(meta) : null]
    );
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error recording event:', error);
    return NextResponse.json({ ok: true }); // Fail silently
  }
}
