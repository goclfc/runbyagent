import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  return authHeader === expectedAuth;
}

function generateBotKey(): string {
  const randomBytes = crypto.randomBytes(16);
  const key = randomBytes.toString('hex');
  return `rb_${key}`;
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
    }

    // Validate id format (alphanumeric, hyphens, underscores)
    if (!/^[a-z0-9_-]+$/i.test(id)) {
      return NextResponse.json({ error: 'invalid id format' }, { status: 400 });
    }

    // Check if bot already exists
    const existing = await query(`
      SELECT id FROM bots WHERE id = $1
    `, [id]);

    if (existing.length > 0) {
      return NextResponse.json({ error: 'bot already exists' }, { status: 409 });
    }

    // Generate key and hash it
    const key = generateBotKey();
    const keyHash = hashKey(key);

    // Insert bot
    await query(`
      INSERT INTO bots (id, name, key_hash)
      VALUES ($1, $2, $3)
    `, [id, name, keyHash]);

    // Return key only once
    return NextResponse.json({ id, key });
  } catch (error) {
    console.error('Error creating bot:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
