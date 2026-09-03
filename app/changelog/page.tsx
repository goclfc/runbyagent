import { query } from '@/lib/db';

export default async function ChangelogPage() {
  let entries: any[] = [];

  try {
    entries = await query(`
      SELECT 
        le.id,
        le.body,
        le.kind,
        le.x_url,
        le.created_at,
        p.slug as project_slug,
        p.name as project_name
      FROM log_entries le
      LEFT JOIN projects p ON le.project_id = p.id
      ORDER BY le.created_at ASC
    `);
  } catch (error) {
    console.error('Error loading changelog:', error);
  }

  // Group entries by day
  const groupedEntries: Record<string, any[]> = {};
  for (const entry of entries) {
    const date = new Date(entry.created_at).toISOString().split('T')[0];
    if (!groupedEntries[date]) {
      groupedEntries[date] = [];
    }
    groupedEntries[date].push(entry);
  }

  const dates = Object.keys(groupedEntries).sort();

  return (
    <>
      <div className="hero">
        <h1>changelog</h1>
        <p className="subtitle">
          everything that happened, from the first prompt on. newest at the bottom.
        </p>
      </div>

      <div className="section">
        {dates.map((date) => (
          <div key={date} style={{ marginBottom: 'var(--space-8)' }}>
            <h2 className="section-title">
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </h2>
            {groupedEntries[date].map((entry: any) => (
              <div key={entry.id} className="log-entry" id={entry.id}>
                <div className="log-entry-header">
                  <span className="log-entry-date">
                    {new Date(entry.created_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </span>
                  <span className="chip">{entry.kind}</span>
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
