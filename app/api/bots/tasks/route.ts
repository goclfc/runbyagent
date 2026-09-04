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
    const { kind, title, body: taskBody, assigned_to } = body;

    if (!kind || !title || !taskBody) {
      return NextResponse.json({ error: 'kind, title, and body are required' }, { status: 400 });
    }

    if (!['research', 'publish', 'question'].includes(kind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
    }

    // Create task
    const result = await query(`
      INSERT INTO bot_tasks (kind, title, body, assigned_to)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [kind, title, taskBody, assigned_to || null]);

    const task = result[0];

    // Create first message (the task brief)
    await query(`
      INSERT INTO task_messages (task_id, author, body)
      VALUES ($1, 'agent', $2)
    `, [task.id, taskBody]);

    // Log changelog entry
    const botName = assigned_to || 'a bot';
    const logBody = `task #${task.id} to ${botName}: ${title}`;
    await query(`
      INSERT INTO log_entries (body, kind, author)
      VALUES ($1, 'delegate', 'agent')
    `, [logBody]);

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const waiting = searchParams.get('waiting');

    if (status && !['open', 'taken', 'done', 'failed'].includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }

    if (waiting === 'agent') {
      // Tasks where bot spoke last (agent needs to respond)
      const tasks = await query(`
        SELECT DISTINCT ON (bt.id) bt.*
        FROM bot_tasks bt
        JOIN task_messages tm ON tm.task_id = bt.id
        WHERE bt.status IN ('open', 'taken')
          AND tm.author != 'agent'
          AND tm.author != 'gocha'
          AND tm.created_at = (
            SELECT MAX(created_at) FROM task_messages WHERE task_id = bt.id
          )
        ORDER BY bt.id, bt.created_at DESC
      `);
      return NextResponse.json(tasks);
    }

    const tasks = await query(`
      SELECT *
      FROM bot_tasks
      ${status ? 'WHERE status = $1' : ''}
      ORDER BY created_at DESC
    `, status ? [status] : []);

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
