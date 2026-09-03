import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { query } from './db';

const COOKIE_NAME = 'rba_vid';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

function generateVisitorId(): string {
  return randomBytes(16).toString('hex');
}

export async function getOrCreateVisitorId(): Promise<{ id: string; isNew: boolean }> {
  const cookieStore = await cookies();
  const existingId = cookieStore.get(COOKIE_NAME);
  
  if (existingId?.value) {
    await incrementPageView(existingId.value);
    return { id: existingId.value, isNew: false };
  }
  
  const newId = generateVisitorId();
  await createVisitorMetadata(newId);
  return { id: newId, isNew: true };
}

export async function setVisitorCookie(visitorId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, visitorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function getVisitorId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

async function createVisitorMetadata(visitorId: string): Promise<void> {
  await query(
    'INSERT INTO visitor_metadata (visitor_id, page_views) VALUES ($1, 1) ON CONFLICT (visitor_id) DO NOTHING',
    [visitorId]
  );
}

async function incrementPageView(visitorId: string): Promise<void> {
  await query(
    'UPDATE visitor_metadata SET page_views = page_views + 1 WHERE visitor_id = $1',
    [visitorId]
  );
}

export async function getVisitorMetadata(visitorId: string): Promise<{ created_at: Date; page_views: number } | null> {
  const result = await query<{ created_at: Date; page_views: number }>(
    'SELECT created_at, page_views FROM visitor_metadata WHERE visitor_id = $1',
    [visitorId]
  );
  return result[0] || null;
}
