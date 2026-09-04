import { query } from '@/lib/db';
import { formatDateTbilisi } from '@/lib/date-utils';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getDoc(slug: string) {
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
      verified_at,
      updated_at,
      views,
      (SELECT COUNT(*) FROM library_versions WHERE doc_id = research_docs.id) as versions_count
    FROM research_docs
    WHERE slug = $1 AND published = true
  `, [slug]);

  if (result.length === 0) {
    return null;
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

  return { ...doc, relatedDocs };
}

export default async function LibraryDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);

  if (!doc) {
    notFound();
  }

  const lines = doc.lines ? (Array.isArray(doc.lines) ? doc.lines : []) : [];
  const sources = doc.sources ? (Array.isArray(doc.sources) ? doc.sources : []) : [];

  return (
    <>
      <div className="hero">
        <div className="log-entry-header" style={{ marginBottom: 'var(--space-3)' }}>
          <span className="chip">{doc.kind}</span>
          <span className="chip">{doc.author}</span>
        </div>
        <h1>{doc.name || 'Untitled'}</h1>
        {doc.summary && (
          <p className="subtitle" style={{ marginTop: 'var(--space-3)' }}>
            {doc.summary}
          </p>
        )}
      </div>

      <div className="section">
        {doc.kind === 'research' && lines.length > 0 && (
          <div className="table-wrapper" style={{ marginBottom: 'var(--space-6)' }}>
            <table>
              <tbody>
                {lines.map((line: string, index: number) => {
                  const cells = line.split(' | ');
                  return (
                    <tr key={index}>
                      {cells.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(doc.kind === 'finding' || doc.kind === 'article') && doc.body_md && (
          <div className="markdown-content" style={{ marginBottom: 'var(--space-6)' }}>
            {doc.body_md.split('\n\n').map((para: string, i: number) => {
              if (para.startsWith('# ')) {
                return <h2 key={i} className="section-title">{para.substring(2)}</h2>;
              }
              if (para.startsWith('## ')) {
                return <h3 key={i} style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)', fontSize: '16px' }}>{para.substring(3)}</h3>;
              }
              return <p key={i} style={{ marginBottom: 'var(--space-3)' }}>{para}</p>;
            })}
          </div>
        )}

        {sources.length > 0 && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 className="section-title">sources</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {sources.map((source: any, index: number) => (
                <li key={index} style={{ marginBottom: 'var(--space-2)' }}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    {source.label || source.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {doc.relatedDocs && doc.relatedDocs.length > 0 && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 className="section-title">related</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {doc.relatedDocs.map((related: any) => (
                <li key={related.slug} style={{ marginBottom: 'var(--space-2)' }}>
                  <Link href={`/library/${related.slug}`} style={{ color: 'var(--accent)' }}>
                    {related.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {doc.versions_count > 0 && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 className="section-title">history</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>
              {doc.versions_count} previous {doc.versions_count === 1 ? 'version' : 'versions'}
            </p>
          </div>
        )}

        <div style={{ marginBottom: 'var(--space-6)', fontSize: '13px', color: 'var(--text-2)' }}>
          <a href={`/api/library/${slug}.md`} style={{ marginRight: 'var(--space-3)' }}>
            download as markdown
          </a>
          <a href={`/api/library/${slug}.json`}>
            download as json
          </a>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
          <span>updated {formatDateTbilisi(doc.updated_at).toLowerCase()}</span>
          {doc.verified_at && (
            <span style={{ marginLeft: 'var(--space-2)' }}>
              · verified {formatDateTbilisi(doc.verified_at).toLowerCase()}
            </span>
          )}
          <span style={{ marginLeft: 'var(--space-2)' }}>
            · {doc.views} {doc.views === 1 ? 'view' : 'views'}
          </span>
        </div>
      </div>
    </>
  );
}
