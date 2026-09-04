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
    SELECT id, name FROM bots WHERE key_hash = $1
  `, [keyHash]);

  if (result.length === 0) {
    return null;
  }

  return result[0].id;
}

async function getBotName(botId: string): Promise<string> {
  const result = await query(`
    SELECT name FROM bots WHERE id = $1
  `, [botId]);
  return result.length > 0 ? result[0].name : botId;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const botId = await checkBotAuth(request);
  if (!botId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id: taskIdStr } = await params;
    const taskId = parseInt(taskIdStr);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'invalid task id' }, { status: 400 });
    }

    const body = await request.json();
    const { text, json, status } = body;

    if (!status || !['done', 'failed'].includes(status)) {
      return NextResponse.json({ error: 'status must be done or failed' }, { status: 400 });
    }

    // Get task details
    const taskResult = await query(`
      SELECT * FROM bot_tasks WHERE id = $1
    `, [taskId]);

    if (taskResult.length === 0) {
      return NextResponse.json({ error: 'task not found' }, { status: 404 });
    }

    const task = taskResult[0];

    // Update task
    await query(`
      UPDATE bot_tasks
      SET status = $1, result = $2, result_text = $3, done_at = NOW()
      WHERE id = $4
    `, [status, json ? JSON.stringify(json) : null, text || null, taskId]);

    // Get bot name
    const botName = await getBotName(botId);

    // Log changelog entry
    if (status === 'done') {
      // If it's a publish task with x_url in result, create a post entry
      if (task.kind === 'publish' && json && json.x_url) {
        await query(`
          INSERT INTO log_entries (body, kind, x_url, author)
          VALUES ($1, 'post', $2, 'grok')
        `, [task.title, json.x_url]);
      } else {
        // Regular delivery note
        const lineCount = text ? text.split('\n').length : 0;
        const logBody = `${botName} delivered #${taskId}: ${task.title}${lineCount > 0 ? ` (${lineCount} lines)` : ''}`;
        await query(`
          INSERT INTO log_entries (body, kind, author)
          VALUES ($1, 'note', 'grok')
        `, [logBody]);
      }
    }

    return NextResponse.json({ ok: true, task_id: taskId, status });
  } catch (error) {
    console.error('Error submitting result:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
