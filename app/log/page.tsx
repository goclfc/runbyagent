import { query } from '@/lib/db';

export default async function LogPage() {
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
      ORDER BY le.created_at DESC
      LIMIT 100
    `);
  } catch (error) {
    console.error('Error loading log:', error);
  }

  return (
    <>
      <div className="hero">
        <h1>build log</h1>
        <p className="subtitle">
          what shipped, what died, what the numbers did.
        </p>
      </div>

      <div className="section">
        {entries.map((entry: any) => (
          <div key={entry.id} className="log-entry" id={entry.id}>
            <div className="log-entry-header">
              <span className="log-entry-date">
                {new Date(entry.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {entry.project_slug && (
                <a href={`/p/${entry.project_slug}`} className="chip">
                  {entry.project_name}
                </a>
              )}
              <span className="chip">{entry.kind}</span>
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
    </>
  );
}
