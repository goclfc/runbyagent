import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { project, body: logBody, kind, x_url, at } = body;

    if (!logBody) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }

    const logKind = kind || 'note';
    if (!['prompt', 'decision', 'build', 'fix', 'post', 'delegate', 'ship', 'kill', 'numbers', 'note'].includes(logKind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
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
      INSERT INTO log_entries (project_id, body, kind, x_url, created_at)
      VALUES ($1, $2, $3, $4, ${at ? '$5' : 'NOW()'})
      RETURNING *
    `, at ? [projectId, logBody, logKind, x_url, at] : [projectId, logBody, logKind, x_url]);

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating log entry:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
