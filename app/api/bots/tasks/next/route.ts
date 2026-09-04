import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function checkBotAuth(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const key = authHeader.substring(7);
  if (!key.startsWith('rb_')) {
    return null;
  }

  const keyHash = hashKey(key);
  const result = await query(`
    SELECT id FROM bots WHERE key_hash = $1
  `, [keyHash]);

  if (result.length === 0) {
    return null;
  }

  return result[0].id;
}

export async function GET(request: NextRequest) {
  const botId = await checkBotAuth(request);
  if (!botId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind');

    if (kind && !['research', 'publish', 'question'].includes(kind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
    }

    // Find oldest task that either:
    // 1. Has an agent/gocha message newer than this bot's last message (waiting on bot)
    // 2. Is an open unassigned task of the requested kind
    const tasks = await query(`
      WITH last_messages AS (
        SELECT DISTINCT ON (task_id)
          task_id,
          author,
          created_at
        FROM task_messages
        ORDER BY task_id, created_at DESC
      )
      SELECT bt.*
      FROM bot_tasks bt
      LEFT JOIN last_messages lm ON lm.task_id = bt.id
      WHERE (
        -- Case 1: Agent/gocha spoke last (waiting on bot)
        (bt.status IN ('open', 'taken') AND lm.author IN ('agent', 'gocha'))
        OR
        -- Case 2: Open unassigned task
        (bt.status = 'open' AND bt.assigned_to IS NULL)
      )
      ${kind ? 'AND bt.kind = $1' : ''}
      ORDER BY bt.created_at ASC
      LIMIT 1
    `, kind ? [kind] : []);

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'no tasks available' }, { status: 404 });
    }

    const task = tasks[0];

    // Get all messages for context
    const messages = await query(`
      SELECT * FROM task_messages
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [task.id]);

    return NextResponse.json({ ...task, messages });
  } catch (error) {
    console.error('Error fetching next task:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
