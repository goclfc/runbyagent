import { query } from '@/lib/db';
import { formatDateShortTbilisi } from '@/lib/date-utils';
import { linesLookLikeMarkdown, renderLines, renderMarkdown } from '@/lib/markdown';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface LibraryDoc {
  id: number;
  slug: string;
  kind: string;
  name: string | null;
  summary: string | null;
  body_md: string | null;
  lines: string[] | null;
  author: string;
  sources: { label?: string; url: string }[] | null;
  related: string[] | null;
  verified_at: string | null;
  updated_at: string;
  views: number;
  cover_url: string | null;
  versions_count: number;
}

async function getDoc(slug: string) {
  const result = await query<LibraryDoc>(`
    SELECT
      id, slug, kind, name, summary, body_md, lines, author, sources, related,
      verified_at, updated_at, views, cover_url,
      (SELECT COUNT(*) FROM library_versions WHERE doc_id = research_docs.id)::int AS versions_count
    FROM research_docs
    WHERE slug = $1 AND published = true
  `, [slug]);

  if (result.length === 0) {
    return null;
  }

  const doc = result[0];

  let relatedDocs: { slug: string; name: string }[] = [];
  if (Array.isArray(doc.related) && doc.related.length > 0) {
    relatedDocs = await query(`
      SELECT slug, name
      FROM research_docs
      WHERE slug = ANY($1::text[]) AND published = true
    `, [doc.related]);
  }

  return { ...doc, relatedDocs };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = await query<{ name: string | null; summary: string | null; cover_url: string | null }>(
    'SELECT name, summary, cover_url FROM research_docs WHERE slug = $1 AND published = true',
    [slug]
  );
  const doc = rows[0];
  if (!doc) return { title: 'library · runbyagent' };
  return {
    title: `${doc.name || 'untitled'} · runbyagent`,
    description: doc.summary || undefined,
    openGraph: doc.cover_url ? { images: [doc.cover_url] } : undefined,
  };
}

export default async function LibraryDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);

  if (!doc) {
    notFound();
  }

  const lines = Array.isArray(doc.lines) ? doc.lines : [];
  const sources = Array.isArray(doc.sources) ? doc.sources : [];

  // body: markdown for findings/articles/setup; research docs are either markdown lines or "a | b | c" rows
  let bodyHtml = '';
  let rows: string[][] = [];
  if (doc.body_md) {
    bodyHtml = renderMarkdown(doc.body_md);
  } else if (lines.length > 0) {
    if (linesLookLikeMarkdown(lines)) {
      bodyHtml = renderLines(lines);
    } else {
      rows = lines.map((line) => line.split(' | '));
    }
  }

  return (
    <article className="doc">
      {doc.cover_url && (
        <img className="doc-banner" src={doc.cover_url} alt="" />
      )}

      <div className="doc-chips">
        <span className="chip">{doc.kind}</span>
        <span className="chip chip-muted">{doc.author}</span>
        {doc.verified_at && <span className="chip chip-muted">verified</span>}
      </div>
      <h1 className="doc-title">{doc.name || 'untitled'}</h1>
      {doc.summary && <p className="doc-lede">{doc.summary}</p>}
      <p className="doc-meta">
        <span>{doc.author}</span>
        <span>{formatDateShortTbilisi(doc.updated_at)}</span>
        <span>{doc.kind}</span>
        <span>{doc.views} {doc.views === 1 ? 'view' : 'views'}</span>
        {doc.versions_count > 0 && (
          <span>{doc.versions_count} previous {doc.versions_count === 1 ? 'version' : 'versions'}</span>
        )}
        <a href={`/api/library/${slug}.md`}>markdown ↓</a>
        <a href={`/api/library/${slug}.json`}>json ↓</a>
      </p>

      {bodyHtml && (
        <div className="doc-body markdown" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      )}

      {rows.length > 0 && (
        <div className="card tw doc-rows">
          <table>
            <tbody>
              {rows.map((cells, index) => (
                <tr key={index}>
                  {cells.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(sources.length > 0 || doc.relatedDocs.length > 0) && (
        <div className="doc-aside">
          {sources.length > 0 && (
            <section className="card">
              <h2 className="doc-aside-title">sources</h2>
              <ol className="doc-list">
                {sources.map((source, index) => (
                  <li key={index}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label || source.url}</a>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {doc.relatedDocs.length > 0 && (
            <section className="card">
              <h2 className="doc-aside-title">related</h2>
              <ul className="doc-list">
                {doc.relatedDocs.map((related) => (
                  <li key={related.slug}>
                    <Link href={`/library/${related.slug}`}>{related.name}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <footer className="doc-footer">
        <span>updated {formatDateShortTbilisi(doc.updated_at)}</span>
        {doc.verified_at && <span>verified {formatDateShortTbilisi(doc.verified_at)}</span>}
        <Link href="/library">back to the library</Link>
      </footer>
    </article>
  );
}
