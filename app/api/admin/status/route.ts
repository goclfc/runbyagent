import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slug, status, note } = body;

    if (!slug || !status) {
      return NextResponse.json({ error: 'slug and status are required' }, { status: 400 });
    }

    if (!['building', 'live', 'dead'].includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }

    const updateFields: string[] = ['status = $2'];
    const values: any[] = [slug, status];
    let paramIndex = 3;

    if (status === 'live') {
      updateFields.push(`launched_at = COALESCE(launched_at, NOW())`);
    } else if (status === 'dead') {
      updateFields.push(`killed_at = NOW()`);
    }

    const updateResult = await query(`
      UPDATE projects
      SET ${updateFields.join(', ')}
      WHERE slug = $1
      RETURNING id, name
    `, values);

    if (updateResult.length === 0) {
      return NextResponse.json({ error: 'project not found' }, { status: 404 });
    }

    const project = updateResult[0];
    const kind = status === 'live' ? 'ship' : status === 'dead' ? 'kill' : 'note';
    const logBody = note || `${project.name} status changed to ${status}`;

    await query(`
      INSERT INTO log_entries (project_id, body, kind)
      VALUES ($1, $2, $3)
    `, [project.id, logBody, kind]);

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
