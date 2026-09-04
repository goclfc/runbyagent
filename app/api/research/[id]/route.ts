import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';
import { normalizeCoverUrl } from '@/lib/cover';

export const dynamic = 'force-dynamic';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function checkAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const key = authHeader.substring(7);
  
  // Check if it's an admin or research key
  const researchKey = process.env.RESEARCH_KEY;
  const adminKey = process.env.ADMIN_KEY;
  
  if (key === researchKey || key === adminKey) {
    return true;
  }
  
  // Check if it's a bot key
  if (key.startsWith('rb_')) {
    const keyHash = hashKey(key);
    const result = await query(`
      SELECT id FROM bots WHERE key_hash = $1
    `, [keyHash]);
    return result.length > 0;
  }
  
  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const docId = parseInt(id);
    if (isNaN(docId)) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }

    const result = await query(`
      SELECT id, name, lines, meta, source, created_at, kind, slug, summary, body_md, author, sources, related, published, verified_at, updated_at, views, cover_url
      FROM research_docs
      WHERE id = $1
    `, [docId]);

    if (result.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const doc = result[0];
    
    return NextResponse.json({
      id: doc.id,
      name: doc.name,
      lines: doc.lines,
      meta: doc.meta,
      source: doc.source,
      created_at: doc.created_at,
      kind: doc.kind,
      slug: doc.slug,
      summary: doc.summary,
      body_md: doc.body_md,
      author: doc.author,
      sources: doc.sources,
      related: doc.related,
      published: doc.published,
      verified_at: doc.verified_at,
      updated_at: doc.updated_at,
      views: doc.views,
      cover_url: doc.cover_url,
    });
  } catch (error) {
    console.error('Error fetching research doc:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const docId = parseInt(id);
    if (isNaN(docId)) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }

    const body = await request.json();

    // Fetch current document
    const current = await query(`
      SELECT id, body_md, summary, author, kind, slug, published
      FROM research_docs
      WHERE id = $1
    `, [docId]);

    if (current.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const currentDoc = current[0];

    // Store previous version if body_md or summary changed
    if ((body.body_md && body.body_md !== currentDoc.body_md) || 
        (body.summary && body.summary !== currentDoc.summary)) {
      await query(`
        INSERT INTO library_versions (doc_id, body_md, summary, author)
        VALUES ($1, $2, $3, $4)
      `, [docId, currentDoc.body_md, currentDoc.summary, currentDoc.author]);
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.kind !== undefined) {
      if (!['research', 'finding', 'article', 'setup'].includes(body.kind)) {
        return NextResponse.json({ error: 'kind must be research, finding, article, or setup' }, { status: 400 });
      }
      updates.push(`kind = $${paramIndex++}`);
      values.push(body.kind);
    }

    if (body.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      values.push(body.slug);
    }

    if (body.summary !== undefined) {
      updates.push(`summary = $${paramIndex++}`);
      values.push(body.summary);
    }

    if (body.body_md !== undefined) {
      updates.push(`body_md = $${paramIndex++}`);
      values.push(body.body_md);
    }

    if (body.author !== undefined) {
      updates.push(`author = $${paramIndex++}`);
      values.push(body.author);
    }

    if (body.sources !== undefined) {
      updates.push(`sources = $${paramIndex++}`);
      values.push(body.sources ? JSON.stringify(body.sources) : null);
    }

    if (body.related !== undefined) {
      updates.push(`related = $${paramIndex++}`);
      values.push(body.related ? JSON.stringify(body.related) : null);
    }

    if (body.published !== undefined) {
      updates.push(`published = $${paramIndex++}`);
      values.push(body.published);
    }

    if (body.cover_url !== undefined) {
      const cover = normalizeCoverUrl(body.cover_url);
      if (cover === undefined) {
        return NextResponse.json({ error: 'cover_url must be a path starting with / or an https url (max 500 chars)' }, { status: 400 });
      }
      updates.push(`cover_url = $${paramIndex++}`);
      values.push(cover);
    }

    // Check for verified flag in body
    if (body.verified === true) {
      updates.push(`verified_at = NOW()`);
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    if (updates.length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
    }

    values.push(docId);

    await query(`
      UPDATE research_docs
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating research doc:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
