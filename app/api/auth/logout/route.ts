import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, redirectTo, safeLocalPath, sessionCookieOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function clear(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return response;
}

function clearAndRedirect(path: string) {
  const response = new NextResponse(null, { status: 303, headers: { Location: path } });
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return response;
}

/** form post from the header: clears the session and goes back to the page it came from */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const next = safeLocalPath(form?.get('next')?.toString());
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  if (wantsJson) return clear(NextResponse.json({ ok: true }));
  return clearAndRedirect(next);
}
