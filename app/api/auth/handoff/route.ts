import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, handoffToken, isAllowedReturnUrl } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * cross-app login. a project sends the visitor here with ?return=<its callback url>.
 * logged in: redirect back with a 60 second token the project verifies with the shared secret.
 * logged out: go to /login first, then come back here.
 */
export async function GET(request: NextRequest) {
  const returnParam = request.nextUrl.searchParams.get('return') || '';
  const target = isAllowedReturnUrl(returnParam);
  if (!target) {
    return NextResponse.json({ error: 'return url is not allowed' }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) {
    const here = `/api/auth/handoff?return=${encodeURIComponent(target.toString())}`;
    return NextResponse.redirect(new URL(`/login?return=${encodeURIComponent(here)}`, request.url), 302);
  }

  target.searchParams.set('rba_token', handoffToken(user, target.origin));
  return NextResponse.redirect(target.toString(), 302);
}
