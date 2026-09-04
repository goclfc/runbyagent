import { NextRequest, NextResponse } from 'next/server';
import { getTopAbuseIps } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const topAbusers = await getTopAbuseIps(24, 100);

    return NextResponse.json({
      period: '24h',
      top_ips: topAbusers
    });
  } catch (error) {
    console.error('Error fetching abuse data:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
