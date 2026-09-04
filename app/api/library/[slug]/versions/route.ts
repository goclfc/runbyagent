import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const n = searchParams.get('n');

    // Get document id
    const docResult = await query(`
      SELECT id FROM research_docs
      WHERE slug = $1 AND published = true
    `, [slug]);

    if (docResult.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const docId = docResult[0].id;

    if (n) {
      // Fetch specific version by index (1-indexed, newest first)
      const versionNum = parseInt(n);
      if (isNaN(versionNum) || versionNum < 1) {
        return NextResponse.json({ error: 'invalid version number' }, { status: 400 });
      }

      const versions = await query(`
        SELECT body_md, summary, author, created_at
        FROM library_versions
        WHERE doc_id = $1
        ORDER BY created_at DESC
        LIMIT 1 OFFSET $2
      `, [docId, versionNum - 1]);

      if (versions.length === 0) {
        return NextResponse.json({ error: 'version not found' }, { status: 404 });
      }

      return NextResponse.json(versions[0]);
    } else {
      // List all versions
      const versions = await query(`
        SELECT created_at, author, summary
        FROM library_versions
        WHERE doc_id = $1
        ORDER BY created_at DESC
      `, [docId]);

      return NextResponse.json(versions);
    }
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
