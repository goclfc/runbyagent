import { query } from '@/lib/db';
import { getDateKeyTbilisi, formatDateTbilisi, formatTimeTbilisi } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ project?: string }>;
}

/** the whole log, oldest first. ?project=<slug> narrows it to one project (the "log" link on its card). */
export default async function ChangelogPage({ searchParams }: PageProps) {
  const { project: projectParam } = await searchParams;
  const projectSlug = projectParam && /^[a-z0-9-]{1,64}$/.test(projectParam) ? projectParam : null;
  let entries: any[] = [];
  let projectName: string | null = null;

  try {
    entries = await query(`
      SELECT 
        le.id,
        le.body,
        le.kind,
        le.x_url,
        le.author,
        le.created_at,
        p.slug as project_slug,
        p.name as project_name
      FROM log_entries le
      LEFT JOIN projects p ON le.project_id = p.id
      ${projectSlug ? 'WHERE p.slug = $1' : ''}
      ORDER BY le.created_at ASC
    `, projectSlug ? [projectSlug] : []);
    if (projectSlug) {
      const rows = await query<{ name: string }>('SELECT name FROM projects WHERE slug = $1', [projectSlug]);
      projectName = rows[0]?.name ?? projectSlug;
    }
  } catch (error) {
    console.error('Error loading changelog:', error);
  }

  // Group entries by day (in Tbilisi timezone)
  const groupedEntries: Record<string, any[]> = {};
  for (const entry of entries) {
    const date = getDateKeyTbilisi(entry.created_at);
    if (!groupedEntries[date]) {
      groupedEntries[date] = [];
    }
    groupedEntries[date].push(entry);
  }

  const dates = Object.keys(groupedEntries).sort();

  return (
    <>
      <div className="hero">
        <h1>{projectName ? `changelog: ${projectName}` : 'changelog'}</h1>
        <p className="subtitle">
          {projectName
            ? <>everything that happened to {projectName}, oldest first. <a href="/changelog">the whole log →</a></>
            : 'everything that happened, from the first prompt on. newest at the bottom.'}
        </p>
        <p className="note" style={{ marginTop: 'var(--space-2)' }}>
          times in tbilisi
        </p>
      </div>

      <div className="section">
        {dates.length === 0 && (
          <p className="note">nothing logged{projectName ? ` for ${projectName}` : ''} yet.</p>
        )}
        {dates.map((date) => (
          <div key={date} style={{ marginBottom: 'var(--space-8)' }}>
            <h2 className="section-title">
              {formatDateTbilisi(date + 'T00:00:00Z')}
            </h2>
            {groupedEntries[date].map((entry: any) => (
              <div key={entry.id} className="log-entry" id={entry.id}>
                <div className="log-entry-header">
                  <span className="log-entry-date">
                    {formatTimeTbilisi(entry.created_at)}
                  </span>
                  <span className="chip">{entry.kind}</span>
                  <span className="chip">{entry.author === 'agent+gocha' ? 'agent + gocha' : entry.author === 'grok' ? 'grok bot' : entry.author}</span>
                  {entry.project_slug && (
                    <a href={`/p/${entry.project_slug}`} className="chip">
                      {entry.project_name}
                    </a>
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
        ))}
      </div>
    </>
  );
}
