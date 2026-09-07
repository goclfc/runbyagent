import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const EDITABLE = ['name', 'tagline', 'url', 'repo_url', 'idea_url', 'status', 'metrics_url', 'stripe_tag', 'screenshot_url', 'launched_at'] as const;
const STATUSES = ['live', 'building', 'killed', 'dead'];

/** edit one project. send only the fields to change; null clears a nullable field. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { slug } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value !== null && typeof value !== 'string') {
      return NextResponse.json({ error: `${key} must be a string or null` }, { status: 400 });
    }
    if (key === 'name' && !value) {
      return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    }
    if (key === 'status' && (!value || !STATUSES.includes(value))) {
      return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
    }
    if (key === 'tagline' && typeof value === 'string' && value.length > 160) {
      return NextResponse.json({ error: 'tagline is one line, 160 characters at most' }, { status: 400 });
    }
    if (key === 'launched_at' && typeof value === 'string' && Number.isNaN(Date.parse(value))) {
      return NextResponse.json({ error: 'launched_at must be a date' }, { status: 400 });
    }
    values.push(typeof value === 'string' ? value.trim() : value);
    sets.push(`${key} = $${values.length}`);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: `nothing to change. editable: ${EDITABLE.join(', ')}` }, { status: 400 });
  }

  try {
    values.push(slug);
    const rows = await query(
      `UPDATE projects SET ${sets.join(', ')} WHERE slug = $${values.length} RETURNING *`,
      values,
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { slug } = await context.params;
  const rows = await query('SELECT * FROM projects WHERE slug = $1', [slug]);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
