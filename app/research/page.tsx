import { query } from '@/lib/db';
import { formatDateTbilisi, formatTimeTbilisi } from '@/lib/date-utils';
import { linesLookLikeMarkdown, renderLines } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

export default async function ResearchPage() {
  let docs: any[] = [];

  try {
    docs = await query(`
      SELECT 
        id,
        name,
        lines,
        meta,
        source,
        created_at,
        jsonb_array_length(lines) as count
      FROM research_docs
      ORDER BY created_at DESC
    `);

    // Filter out private docs
    docs = docs.filter(doc => {
      if (!doc.meta) return true;
      const meta = typeof doc.meta === 'string' ? JSON.parse(doc.meta) : doc.meta;
      return !meta.private;
    });
  } catch (error) {
    console.error('Error loading research docs:', error);
  }

  return (
    <>
      <div className="hero">
        <h1>research</h1>
        <p className="subtitle">
          research delivered by the grok bots, straight into the platform.
        </p>
        <p className="note" style={{ marginTop: 'var(--space-2)' }}>
          times in tbilisi
        </p>
      </div>

      <div className="section">
        {docs.map((doc) => {
          const lines = doc.lines as string[];
          return (
            <div key={doc.id} style={{ marginBottom: 'var(--space-8)' }}>
              <div className="log-entry-header">
                <span className="log-entry-date">
                  {formatDateTbilisi(doc.created_at)} {formatTimeTbilisi(doc.created_at)}
                </span>
                <span className="chip">research</span>
                {doc.source && <span className="chip">{doc.source}</span>}
              </div>
              <h2 className="section-title" style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {doc.name || `Document #${doc.id}`}
              </h2>
              {linesLookLikeMarkdown(lines) ? (
                <div className="doc-body markdown" dangerouslySetInnerHTML={{ __html: renderLines(lines) }} />
              ) : (
                <div className="table-wrapper">
                  <table>
                    <tbody>
                      {lines.map((line, index) => {
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
              <p style={{ marginTop: 'var(--space-2)', fontSize: '13px', color: 'var(--text-2)' }}>
                {doc.count} lines
              </p>
            </div>
          );
        })}
        {docs.length === 0 && (
          <p style={{ color: 'var(--text-2)' }}>No research documents yet.</p>
        )}
      </div>
    </>
  );
}
