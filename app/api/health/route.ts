import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbOk = false;

  try {
    await query('SELECT 1');
    dbOk = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  return NextResponse.json({
    ok: dbOk,
    db: dbOk,
  });
}
