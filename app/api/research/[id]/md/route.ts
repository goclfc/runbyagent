import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_KEY}`;
  return authHeader === expectedAuth;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!checkAuth(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Remove .md extension to get the actual ID
    const docId = parseInt(params.id.replace(/\.md$/, ''));
    if (isNaN(docId)) {
      return new Response('Invalid ID', { status: 400 });
    }

    const result = await query(`
      SELECT lines
      FROM research_docs
      WHERE id = $1
    `, [docId]);

    if (result.length === 0) {
      return new Response('Not Found', { status: 404 });
    }

    const doc = result[0];
    const lines = doc.lines as string[];
    const text = lines.join('\n');

    return new Response(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error fetching research doc:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
