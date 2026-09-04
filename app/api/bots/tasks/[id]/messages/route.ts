import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function checkAdminAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  return authHeader === expectedAuth;
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
  const isAdmin = checkAdminAuth(request);
  const botId = await checkBotAuth(request);

  if (!isAdmin && !botId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id: taskIdStr } = await params;
    const taskId = parseInt(taskIdStr);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'invalid task id' }, { status: 400 });
    }

    const body = await request.json();
    const { body: messageBody, attachments, as, status } = body;

    if (!messageBody) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }

    // Get task
    const taskResult = await query(`
      SELECT * FROM bot_tasks WHERE id = $1
    `, [taskId]);

    if (taskResult.length === 0) {
      return NextResponse.json({ error: 'task not found' }, { status: 404 });
    }

    const task = taskResult[0];

    // Determine author
    let author: string;
    if (isAdmin) {
      author = as === 'gocha' ? 'gocha' : 'agent';
    } else {
      author = botId!;
    }

    // Insert message
    const messageResult = await query(`
      INSERT INTO task_messages (task_id, author, body, attachments)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [taskId, author, messageBody, attachments ? JSON.stringify(attachments) : null]);

    const message = messageResult[0];

    // Handle task status changes
    if (status) {
      if (botId && !['done', 'failed'].includes(status)) {
        return NextResponse.json({ error: 'bots can only set status to done or failed' }, { status: 400 });
      }
      if (isAdmin && !['open', 'done', 'failed'].includes(status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      }

      await query(`
        UPDATE bot_tasks
        SET status = $1, done_at = ${status === 'done' || status === 'failed' ? 'NOW()' : 'NULL'}
        WHERE id = $2
      `, [status, taskId]);

      // Log closing changelog entry
      if ((status === 'done' || status === 'failed') && botId) {
        const botName = await getBotName(botId);
        
        // If it's a publish task with x_url in attachments, create post entry
        if (task.kind === 'publish' && attachments && attachments.x_url) {
          await query(`
            INSERT INTO log_entries (body, kind, x_url, author)
            VALUES ($1, 'post', $2, 'grok')
          `, [task.title, attachments.x_url]);
        } else {
          // Regular closing note with link to thread
          const truncatedBody = messageBody.length > 300 ? messageBody.substring(0, 300) + '...' : messageBody;
          const logBody = `${botName} on #${taskId}: ${truncatedBody}`;
          await query(`
            INSERT INTO log_entries (body, kind, author)
            VALUES ($1, 'note', 'grok')
          `, [logBody]);
        }
      }
    } else if (botId && task.status === 'open') {
      // Bot posting on open task marks it taken
      await query(`
        UPDATE bot_tasks
        SET status = 'taken', taken_at = NOW()
        WHERE id = $1
      `, [taskId]);
    }

    // Log bot message to changelog (if bot and not a closing message)
    if (botId && !status) {
      const botName = await getBotName(botId);
      const truncatedBody = messageBody.length > 300 ? messageBody.substring(0, 300) + '...' : messageBody;
      const logBody = `${botName} on #${taskId}: ${truncatedBody}`;
      await query(`
        INSERT INTO log_entries (body, kind, author)
        VALUES ($1, 'note', 'grok')
      `, [logBody]);
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error posting message:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
