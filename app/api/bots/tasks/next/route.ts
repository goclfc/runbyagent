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

    // Find oldest open task (assigned to this bot OR unassigned) for the requested kind
    const tasks = await query(`
      SELECT *
      FROM bot_tasks
      WHERE status = 'open'
        AND (assigned_to IS NULL OR assigned_to = $1)
        ${kind ? 'AND kind = $2' : ''}
      ORDER BY created_at ASC
      LIMIT 1
    `, kind ? [botId, kind] : [botId]);

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'no tasks available' }, { status: 404 });
    }

    const task = tasks[0];

    // Mark as taken
    await query(`
      UPDATE bot_tasks
      SET status = 'taken', taken_at = NOW()
      WHERE id = $1
    `, [task.id]);

    return NextResponse.json({ ...task, status: 'taken', taken_at: new Date() });
  } catch (error) {
    console.error('Error fetching next task:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
