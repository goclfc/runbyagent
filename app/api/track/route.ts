import { NextRequest, NextResponse } from 'next/server';
import { CORS_HEADERS, allowBeacon, isBot, isValidVid, readBeacon, recordView, resolveProjectId } from '@/lib/track';

export const dynamic = 'force-dynamic';

/** page view beacon from rba.js: { project, vid, path?, ref? }. any origin, no auth, 1 kb. */
export async function POST(req: NextRequest) {
  const parsed = await readBeacon(req);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: CORS_HEADERS });
  }
  const { project, vid } = parsed.body;
  if (!isValidVid(vid)) {
    return NextResponse.json({ error: 'invalid vid' }, { status: 400, headers: CORS_HEADERS });
  }
  const projectId = await resolveProjectId(project);
  if (projectId === null) {
    return NextResponse.json({ error: 'unknown project' }, { status: 404, headers: CORS_HEADERS });
  }
  if (isBot(req.headers.get('user-agent') || '')) {
    return NextResponse.json({ ok: true, skipped: 'bot' }, { headers: CORS_HEADERS });
  }
  if (!allowBeacon(vid)) {
    return NextResponse.json({ error: 'too many beacons' }, { status: 429, headers: CORS_HEADERS });
  }
  try {
    await recordView(projectId, vid);
  } catch (error) {
    console.error('track: failed to record view', error);
  }
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
