import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const id = params.id;
    const body = await request.json();
    const { body: logBody, kind, x_url, at } = body;

    if (kind && !['prompt', 'decision', 'build', 'fix', 'post', 'delegate', 'ship', 'kill', 'numbers', 'note'].includes(kind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (logBody !== undefined) {
      updates.push(`body = $${paramIndex++}`);
      values.push(logBody);
    }

    if (kind !== undefined) {
      updates.push(`kind = $${paramIndex++}`);
      values.push(kind);
    }

    if (x_url !== undefined) {
      updates.push(`x_url = $${paramIndex++}`);
      values.push(x_url);
    }

    if (at !== undefined) {
      updates.push(`created_at = $${paramIndex++}`);
      values.push(at);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
    }

    values.push(id);

    const result = await query(`
      UPDATE log_entries
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    if (result.length === 0) {
      return NextResponse.json({ error: 'log entry not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating log entry:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const id = params.id;

    const result = await query(`
      DELETE FROM log_entries
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (result.length === 0) {
      return NextResponse.json({ error: 'log entry not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: result[0].id });
  } catch (error) {
    console.error('Error deleting log entry:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
