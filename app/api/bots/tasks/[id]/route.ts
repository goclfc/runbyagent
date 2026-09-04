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

export async function GET(
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

    // Get task
    const taskResult = await query(`
      SELECT * FROM bot_tasks WHERE id = $1
    `, [taskId]);

    if (taskResult.length === 0) {
      return NextResponse.json({ error: 'task not found' }, { status: 404 });
    }

    const task = taskResult[0];

    // Get all messages for this task
    const messages = await query(`
      SELECT * FROM task_messages
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [taskId]);

    return NextResponse.json({ ...task, messages });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
