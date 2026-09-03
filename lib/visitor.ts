import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

const COOKIE_NAME = 'rba_vid';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

function generateVisitorId(): string {
  return randomBytes(16).toString('hex');
}

export async function getOrCreateVisitorId(): Promise<string> {
  const cookieStore = await cookies();
  const existingId = cookieStore.get(COOKIE_NAME);
  
  if (existingId?.value) {
    return existingId.value;
  }
  
  return generateVisitorId();
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
