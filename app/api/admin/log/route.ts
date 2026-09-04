import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  return authHeader === expectedAuth;
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { project, body: logBody, kind, x_url, at, author } = body;

    if (!logBody) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }

    const logKind = kind || 'note';
    if (!['prompt', 'decision', 'build', 'fix', 'post', 'delegate', 'ship', 'kill', 'numbers', 'note'].includes(logKind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
    }

    const logAuthor = author || 'agent';
    if (!logAuthor || logAuthor.length === 0 || logAuthor.length > 32 || !/^[a-z0-9_+-]{1,32}$/i.test(logAuthor)) {
      return NextResponse.json({ error: 'invalid author (must be non-empty slug up to 32 chars)' }, { status: 400 });
    }

    let projectId = null;
    if (project) {
      const projectResult = await query(`
        SELECT id FROM projects WHERE slug = $1
      `, [project]);
      
      if (projectResult.length === 0) {
        return NextResponse.json({ error: 'project not found' }, { status: 404 });
      }
      projectId = projectResult[0].id;
    }

    const result = await query(`
      INSERT INTO log_entries (project_id, body, kind, x_url, created_at, author)
      VALUES ($1, $2, $3, $4, ${at ? '$5' : 'NOW()'}, ${at ? '$6' : '$5'})
      RETURNING *
    `, at ? [projectId, logBody, logKind, x_url, at, logAuthor] : [projectId, logBody, logKind, x_url, logAuthor]);

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating log entry:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, body: logBody, kind, x_url, at, author } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (kind && !['prompt', 'decision', 'build', 'fix', 'post', 'delegate', 'ship', 'kill', 'numbers', 'note'].includes(kind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
    }

    if (author && (!author || author.length === 0 || author.length > 32 || !/^[a-z0-9_+-]{1,32}$/i.test(author))) {
      return NextResponse.json({ error: 'invalid author (must be non-empty slug up to 32 chars)' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (logBody !== undefined) {
      updates.push(`body = $${paramCount++}`);
      values.push(logBody);
    }
    if (kind !== undefined) {
      updates.push(`kind = $${paramCount++}`);
      values.push(kind);
    }
    if (x_url !== undefined) {
      updates.push(`x_url = $${paramCount++}`);
      values.push(x_url);
    }
    if (at !== undefined) {
      updates.push(`created_at = $${paramCount++}`);
      values.push(at);
    }
    if (author !== undefined) {
      updates.push(`author = $${paramCount++}`);
      values.push(author);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
    }

    values.push(id);
    const result = await query(`
      UPDATE log_entries
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating log entry:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const result = await query(`
      DELETE FROM log_entries
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error deleting log entry:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
