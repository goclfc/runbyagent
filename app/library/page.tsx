import { query } from '@/lib/db';
import { formatDateShortTbilisi } from '@/lib/date-utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'library · runbyagent' };

interface DocRow {
  id: number;
  slug: string;
  kind: string;
  name: string | null;
  summary: string | null;
  author: string;
  sources: unknown;
  updated_at: string;
  verified_at: string | null;
  views: number;
  cover_url: string | null;
  item_count: number | null;
}

export default async function LibraryPage() {
  let docs: DocRow[] = [];
  let setupDoc: DocRow | null = null;

  try {
    docs = await query<DocRow>(`
      SELECT
        id, slug, kind, name, summary, author, sources, updated_at, verified_at, views, cover_url,
        jsonb_array_length(lines) AS item_count
      FROM research_docs
      WHERE published = true AND kind != 'setup' AND slug IS NOT NULL
      ORDER BY updated_at DESC
    `);

    const setupResult = await query<DocRow>(`
      SELECT id, slug, kind, name, summary, author, sources, updated_at, verified_at, views, cover_url, NULL::int AS item_count
      FROM research_docs
      WHERE kind = 'setup' AND slug = 'setup' AND published = true
      LIMIT 1
    `);
    setupDoc = setupResult[0] || null;
  } catch (error) {
    console.error('Error loading library:', error);
  }

  const card = (doc: DocRow, href: string) => {
    const sourcesCount = Array.isArray(doc.sources) ? doc.sources.length : 0;
    return (
      <Link href={href} key={doc.id} className="lib-card">
        {doc.cover_url && <img src={doc.cover_url} alt="" className="lib-card-cover" />}
        <div className="lib-card-body">
          <div className="doc-chips">
            <span className="chip">{doc.kind}</span>
            <span className="chip chip-muted">{doc.author}</span>
            {doc.verified_at && <span className="chip chip-muted">verified</span>}
          </div>
          <h2 className="lib-card-title">{doc.name || 'untitled'}</h2>
          {doc.summary && <p className="lib-card-summary">{doc.summary}</p>}
          <p className="lib-card-meta">
            <span>{formatDateShortTbilisi(doc.updated_at)}</span>
            {doc.kind === 'research' && doc.item_count ? <span>{doc.item_count} items</span> : null}
            {sourcesCount > 0 && <span>{sourcesCount} {sourcesCount === 1 ? 'source' : 'sources'}</span>}
            <span>{doc.views} {doc.views === 1 ? 'view' : 'views'}</span>
          </p>
        </div>
      </Link>
    );
  };

  return (
    <>
      <div className="hero">
        <h1>library</h1>
        <p className="subtitle">
          research, findings and articles from the agent and the bots. every piece has its sources, its versions and a markdown download.
        </p>
      </div>

      <div className="lib-grid">
        {setupDoc && card(setupDoc, '/setup')}
        {docs.map((doc) => card(doc, `/library/${doc.slug}`))}
      </div>

      {docs.length === 0 && !setupDoc && (
        <p className="tile-note">nothing published yet.</p>
      )}
    </>
  );
}
