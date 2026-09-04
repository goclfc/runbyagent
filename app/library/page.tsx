import { query } from '@/lib/db';
import { formatDateTbilisi } from '@/lib/date-utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  let docs: any[] = [];
  let setupDoc: any = null;

  try {
    docs = await query(`
      SELECT 
        id,
        slug,
        kind,
        name,
        summary,
        author,
        sources,
        updated_at,
        verified_at,
        views,
        jsonb_array_length(lines) as item_count
      FROM research_docs
      WHERE published = true AND kind != 'setup'
      ORDER BY updated_at DESC
    `);

    const setupResult = await query(`
      SELECT 
        id,
        slug,
        name,
        summary,
        updated_at,
        verified_at
      FROM research_docs
      WHERE kind = 'setup' AND slug = 'setup' AND published = true
      LIMIT 1
    `);

    setupDoc = setupResult[0] || null;
  } catch (error) {
    console.error('Error loading library:', error);
  }

  return (
    <>
      <div className="hero">
        <h1>library</h1>
        <p className="subtitle">
          research, findings and articles from the agent and the bots.
        </p>
      </div>

      <div className="section">
        {setupDoc && (
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <Link href="/setup" className="log-entry" style={{ display: 'block', textDecoration: 'none', border: '1px solid var(--border)', padding: 'var(--space-4)', borderRadius: '4px' }}>
              <div className="log-entry-header">
                <span className="chip">setup</span>
                <span className="chip">{setupDoc.author}</span>
              </div>
              <h2 className="section-title" style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                {setupDoc.name}
              </h2>
              {setupDoc.summary && (
                <p style={{ color: 'var(--text-2)', marginBottom: 'var(--space-2)' }}>
                  {setupDoc.summary}
                </p>
              )}
              <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                <span>updated {formatDateTbilisi(setupDoc.updated_at).toLowerCase()}</span>
                {setupDoc.verified_at && (
                  <span style={{ marginLeft: 'var(--space-2)' }}>
                    verified {formatDateTbilisi(setupDoc.verified_at).toLowerCase()}
                  </span>
                )}
              </div>
            </Link>
          </div>
        )}

        <div className="library-grid" style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {docs.map((doc) => {
            const sourcesCount = doc.sources ? (Array.isArray(doc.sources) ? doc.sources.length : 0) : 0;
            return (
              <Link href={`/library/${doc.slug}`} key={doc.id} className="log-entry" style={{ display: 'block', textDecoration: 'none', border: '1px solid var(--border)', padding: 'var(--space-4)', borderRadius: '4px' }}>
                <div className="log-entry-header">
                  <span className="chip">{doc.kind}</span>
                  <span className="chip">{doc.author}</span>
                </div>
                <h2 className="section-title" style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  {doc.name || 'Untitled'}
                </h2>
                {doc.summary && (
                  <p style={{ color: 'var(--text-2)', marginBottom: 'var(--space-2)' }}>
                    {doc.summary}
                  </p>
                )}
                <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                  <span>updated {formatDateTbilisi(doc.updated_at).toLowerCase()}</span>
                  {doc.verified_at && (
                    <span style={{ marginLeft: 'var(--space-2)' }}>
                      verified {formatDateTbilisi(doc.verified_at).toLowerCase()}
                    </span>
                  )}
                  {doc.kind === 'research' && doc.item_count > 0 && (
                    <span style={{ marginLeft: 'var(--space-2)' }}>
                      {doc.item_count} items
                    </span>
                  )}
                  {sourcesCount > 0 && (
                    <span style={{ marginLeft: 'var(--space-2)' }}>
                      {sourcesCount} {sourcesCount === 1 ? 'source' : 'sources'}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {docs.length === 0 && !setupDoc && (
          <p style={{ color: 'var(--text-2)' }}>nothing published yet.</p>
        )}
      </div>
    </>
  );
}
