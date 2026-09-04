import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MAX_LINES = 5000;
const MAX_BODY_SIZE = 200 * 1024; // 200 KB

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const researchKey = process.env.RESEARCH_KEY;
  const adminKey = process.env.ADMIN_KEY;
  
  if (!authHeader) return false;
  
  return authHeader === `Bearer ${researchKey}` || authHeader === `Bearer ${adminKey}`;
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    const { searchParams } = new URL(request.url);
    
    // Check body size (approximate)
    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'body too large (max 200 KB)' }, { status: 413 });
    }

    let name: string | null = null;
    let lines: string[] = [];
    let meta: any = null;
    let source: string | null = null;

    if (contentType.includes('application/json')) {
      const body = JSON.parse(bodyText);
      name = body.name || null;
      meta = body.meta || null;
      source = body.source || null;

      if (Array.isArray(body.lines)) {
        lines = body.lines;
      } else if (typeof body.lines === 'string') {
        lines = body.lines.split('\n');
      } else {
        return NextResponse.json({ error: 'lines must be a string or array' }, { status: 400 });
      }
    } else if (contentType.includes('text/plain') || !contentType) {
      // Plain text body
      name = searchParams.get('name') || null;
      source = searchParams.get('source') || null;
      lines = bodyText.split('\n');
    } else {
      return NextResponse.json({ error: 'unsupported content type' }, { status: 415 });
    }

    if (lines.length === 0) {
      return NextResponse.json({ error: 'lines cannot be empty' }, { status: 400 });
    }

    if (lines.length > MAX_LINES) {
      return NextResponse.json({ error: `too many lines (max ${MAX_LINES})` }, { status: 413 });
    }

    const result = await query(`
      INSERT INTO research_docs (name, lines, meta, source)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name
    `, [name, JSON.stringify(lines), meta ? JSON.stringify(meta) : null, source]);

    const doc = result[0];
    const count = lines.length;

    // Log changelog entry
    const logBody = `research: ${name || 'untitled'}, ${count} lines${source ? ` from ${source}` : ''}`;
    await query(`
      INSERT INTO log_entries (body, kind)
      VALUES ($1, 'note')
    `, [logBody]);

    return NextResponse.json({
      id: doc.id,
      name: doc.name,
      count,
    });
  } catch (error) {
    console.error('Error creating research doc:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
