import { query } from '@/lib/db';
import { formatDateTbilisi, formatTimeTbilisi } from '@/lib/date-utils';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

async function getSetupDoc() {
  const result = await query(`
    SELECT 
      id,
      slug,
      name,
      summary,
      body_md,
      author,
      sources,
      verified_at,
      updated_at,
      views
    FROM research_docs
    WHERE kind = 'setup' AND slug = 'setup' AND published = true
    LIMIT 1
  `);

  return result[0] || null;
}

async function getRoutines() {
  try {
    const routinesPath = path.join(process.cwd(), 'config', 'routines.json');
    if (fs.existsSync(routinesPath)) {
      const routinesData = fs.readFileSync(routinesPath, 'utf-8');
      return JSON.parse(routinesData);
    }
  } catch (error) {
    console.error('Error reading routines:', error);
  }
  return [];
}

async function getRoutineLastRuns(routines: any[]) {
  const tags = routines.map(r => r.tag);
  
  if (tags.length === 0) {
    return {};
  }

  const lastRuns: any = {};
  
  for (const tag of tags) {
    const result = await query(`
      SELECT created_at
      FROM log_entries
      WHERE body LIKE $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [`${tag}%`]);
    
    if (result.length > 0) {
      lastRuns[tag] = result[0].created_at;
    }
  }
  
  return lastRuns;
}

async function getRecentSetupChanges() {
  const keywords = ['cursor', 'grok', 'weebo', 'threadbus', 'routine', 'usectl', 'scheduled'];
  const likeConditions = keywords.map((_, i) => `body ILIKE $${i + 1}`).join(' OR ');
  const params = keywords.map(k => `%${k}%`);

  return await query(`
    SELECT 
      le.id,
      le.body,
      le.kind,
      le.x_url,
      le.created_at,
      le.author,
      p.slug as project_slug,
      p.name as project_name
    FROM log_entries le
    LEFT JOIN projects p ON le.project_id = p.id
    WHERE kind IN ('build', 'ship', 'decision') AND (${likeConditions})
    ORDER BY le.created_at DESC
    LIMIT 10
  `, params);
}

export default async function SetupPage() {
  const doc = await getSetupDoc();
  const routines = await getRoutines();
  const lastRuns = await getRoutineLastRuns(routines);
  const recentChanges = await getRecentSetupChanges();

  const sources = doc?.sources ? (Array.isArray(doc.sources) ? doc.sources : []) : [];

  return (
    <>
      <div className="hero">
        <div className="log-entry-header" style={{ marginBottom: 'var(--space-3)' }}>
          <span className="chip">setup</span>
          {doc && <span className="chip">{doc.author}</span>}
        </div>
        <h1>{doc?.name || 'the setup'}</h1>
        {doc?.summary && (
          <p className="subtitle" style={{ marginTop: 'var(--space-3)' }}>
            {doc.summary}
          </p>
        )}
      </div>

      <div className="section">
        {doc?.body_md ? (
          <div className="markdown-content" style={{ marginBottom: 'var(--space-8)' }}>
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
        ) : (
          <div style={{ marginBottom: 'var(--space-8)', color: 'var(--text-2)', fontStyle: 'italic' }}>
            <p>the setup article is being written by the agent; check back soon.</p>
          </div>
        )}

        {routines.length > 0 && (
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <h2 className="section-title">routines</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>name</th>
                    <th>schedule (tbilisi)</th>
                    <th>owner</th>
                    <th>what</th>
                    <th>last run</th>
                  </tr>
                </thead>
                <tbody>
                  {routines.map((routine: any) => (
                    <tr key={routine.id}>
                      <td>{routine.name}</td>
                      <td>{routine.schedule_tbilisi}</td>
                      <td>{routine.owner}</td>
                      <td>{routine.what}</td>
                      <td>
                        {lastRuns[routine.tag] 
                          ? formatTimeTbilisi(lastRuns[routine.tag])
                          : 'never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {recentChanges.length > 0 && (
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <h2 className="section-title">last 10 changes to the setup</h2>
            {recentChanges.map((entry: any) => (
              <div key={entry.id} className="log-entry" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="log-entry-header">
                  <span className="log-entry-date">
                    {formatDateTbilisi(entry.created_at).toLowerCase()} {formatTimeTbilisi(entry.created_at)}
                  </span>
                  <span className="chip">{entry.kind}</span>
                  <span className="chip">{entry.author}</span>
                  {entry.project_slug && (
                    <Link href={`/p/${entry.project_slug}`} className="chip">
                      {entry.project_name}
                    </Link>
                  )}
                  {entry.x_url && (
                    <a href={entry.x_url} target="_blank" rel="noopener noreferrer">
                      x →
                    </a>
                  )}
                </div>
                <div className="log-entry-body">
                  {entry.body.split('\n\n').map((para: string, i: number) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>
            ))}
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

        {doc && (
          <>
            <div style={{ marginBottom: 'var(--space-6)', fontSize: '13px', color: 'var(--text-2)' }}>
              <a href="/api/library/setup.md" style={{ marginRight: 'var(--space-3)' }}>
                download as markdown
              </a>
              <a href="/api/library/setup.json">
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
          </>
        )}
      </div>
    </>
  );
}
