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
    const { slug, day, cents } = body;

    if (!slug || !day || cents === undefined) {
      return NextResponse.json({ error: 'slug, day, and cents are required' }, { status: 400 });
    }

    const projectResult = await query(`
      SELECT id FROM projects WHERE slug = $1
    `, [slug]);
    
    if (projectResult.length === 0) {
      return NextResponse.json({ error: 'project not found' }, { status: 404 });
    }

    const result = await query(`
      INSERT INTO revenue_daily (project_id, day, cents, source)
      VALUES ($1, $2, $3, 'manual')
      ON CONFLICT (project_id, day, source) DO UPDATE SET
        cents = EXCLUDED.cents
      RETURNING *
    `, [projectResult[0].id, day, cents]);

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error adding manual revenue:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
