import { NextResponse } from 'next/server';
import { listProjects } from '@/lib/projects';

export const dynamic = 'force-dynamic';

/** every project with revenue and the platform-counted numbers (online, views, visitors, returning). */
export async function GET() {
  try {
    return NextResponse.json(await listProjects());
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
