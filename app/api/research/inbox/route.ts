import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const MAX_LINES = 5000;
const MAX_BODY_SIZE = 200 * 1024; // 200 KB

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function checkAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const key = authHeader.substring(7);
  
  // Check if it's an admin or research key
  const researchKey = process.env.RESEARCH_KEY;
  const adminKey = process.env.ADMIN_KEY;
  
  if (key === researchKey || key === adminKey) {
    return true;
  }
  
  // Check if it's a bot key
  if (key.startsWith('rb_')) {
    const keyHash = hashKey(key);
    const result = await query(`
      SELECT id FROM bots WHERE key_hash = $1
    `, [keyHash]);
    return result.length > 0;
  }
  
  return false;
}

export async function POST(request: NextRequest) {
  const isAuthorized = await checkAuth(request);
  if (!isAuthorized) {
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
    let taskId: number | null = null;

    if (contentType.includes('application/json')) {
      const body = JSON.parse(bodyText);
      name = body.name || null;
      meta = body.meta || null;
      source = body.source || null;
      taskId = body.task_id ? parseInt(body.task_id) : null;

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
      const taskIdParam = searchParams.get('task_id');
      taskId = taskIdParam ? parseInt(taskIdParam) : null;
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

    // If task_id is provided, attach this doc to the task thread
    if (taskId) {
      await query(`
        INSERT INTO task_messages (task_id, author, body, attachments)
        VALUES ($1, 'agent', $2, $3)
      `, [taskId, `Research document: ${name || 'untitled'}`, JSON.stringify({ research_doc_id: doc.id })]);
    }

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
