import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; format: string }> }
) {
  try {
    const { slug, format } = await params;

    if (format !== 'md' && format !== 'json') {
      return NextResponse.json({ error: 'format must be md or json' }, { status: 400 });
    }

    const result = await query(`
      SELECT id, slug, kind, name, summary, body_md, lines, author, sources, related, verified_at, updated_at
      FROM research_docs
      WHERE slug = $1 AND published = true
    `, [slug]);

    if (result.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    const doc = result[0];

    if (format === 'md') {
      const markdown = doc.body_md || (Array.isArray(doc.lines) ? doc.lines.join('\n') : '');
      return new NextResponse(markdown, {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': `inline; filename="${slug}.md"`,
        },
      });
    } else {
      return new NextResponse(JSON.stringify(doc, null, 2), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `inline; filename="${slug}.json"`,
        },
      });
    }
  } catch (error) {
    console.error('Error fetching library doc download:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
