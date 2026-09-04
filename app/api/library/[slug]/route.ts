import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getVisitorId } from '@/lib/visitor';
import { getDateKeyTbilisi } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const result = await query(`
      SELECT 
        id,
        slug,
        kind,
        name,
        summary,
        body_md,
        lines,
        author,
        sources,
        related,
        published,
        verified_at,
        updated_at,
        views,
        (SELECT COUNT(*) FROM library_versions WHERE doc_id = research_docs.id) as versions_count
      FROM research_docs
      WHERE slug = $1 AND published = true
    `, [slug]);

    if (result.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const doc = result[0];

    // Resolve related docs
    let relatedDocs = [];
    if (doc.related && Array.isArray(doc.related)) {
      const relatedSlugs = doc.related;
      if (relatedSlugs.length > 0) {
        relatedDocs = await query(`
          SELECT slug, name
          FROM research_docs
          WHERE slug = ANY($1::text[]) AND published = true
        `, [relatedSlugs]);
      }
    }

    // Track view (once per visitor per day)
    const visitorId = getVisitorId();
    const today = getDateKeyTbilisi(new Date().toISOString());
    
    const existingView = await query(`
      SELECT 1 FROM events
      WHERE visitor_id = $1 AND name = 'library_view' AND path = $2
      AND created_at >= $3::date
      LIMIT 1
    `, [visitorId, `/library/${slug}`, today]);

    if (existingView.length === 0) {
      await query(`
        INSERT INTO events (visitor_id, name, path, meta)
        VALUES ($1, 'library_view', $2, $3)
      `, [visitorId, `/library/${slug}`, JSON.stringify({ slug })]);

      await query(`
        UPDATE research_docs SET views = views + 1 WHERE id = $1
      `, [doc.id]);

      doc.views += 1;
    }

    return NextResponse.json({
      id: doc.id,
      slug: doc.slug,
      kind: doc.kind,
      name: doc.name,
      summary: doc.summary,
      body_md: doc.body_md,
      lines: doc.lines,
      author: doc.author,
      sources: doc.sources,
      related: relatedDocs,
      verified_at: doc.verified_at,
      updated_at: doc.updated_at,
      views: doc.views,
      versions_count: doc.versions_count,
    });
  } catch (error) {
    console.error('Error fetching library doc:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
