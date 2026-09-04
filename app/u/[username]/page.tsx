import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { formatDateShortTbilisi, formatTimeTbilisi } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

interface Profile {
  id: number;
  username: string;
  karma: number;
  created_at: string;
  rank: number;
}

interface KarmaEvent {
  app: string;
  kind: string;
  ref: string;
  delta: number;
  created_at: string;
}

function describe(e: KarmaEvent): string {
  const what = e.kind === 'upvote' ? 'upvoted' : 'replied to';
  return `${what} ${e.ref.replace(/[:_]/g, ' ')} on ${e.app}`;
}

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const rows = await query<Profile>(
    `SELECT id, username, karma, created_at,
            (SELECT COUNT(*) + 1 FROM users o WHERE o.karma > u.karma OR (o.karma = u.karma AND o.created_at < u.created_at))::int AS rank
     FROM users u WHERE LOWER(username) = LOWER($1)`,
    [username]
  );
  const user = rows[0];
  if (!user) notFound();

  const events = await query<KarmaEvent>(
    'SELECT app, kind, ref, delta, created_at FROM karma_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [user.id]
  );
  const upvotes = events.filter((e) => e.kind === 'upvote').length;
  const replies = events.filter((e) => e.kind === 'reply').length;

  return (
    <div className="user-page">
      <div className="bento-tile">
        <div className="eyebrow">user</div>
        <h1>{user.username}</h1>
        <p className="subtitle">rank {user.rank} on the <a href="/users">users leaderboard</a>. member since {formatDateShortTbilisi(user.created_at)}.</p>
        <div className="stats-grid">
          <div className="stat-tile">
            <div className="stat-label">karma</div>
            <div className="stat-value">{user.karma}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">upvotes</div>
            <div className="stat-value">{upvotes}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">replies</div>
            <div className="stat-value">{replies}</div>
          </div>
        </div>
        <h2 className="section-title">how the karma came in</h2>
        {events.length === 0 ? (
          <p className="chart-empty">nothing yet. upvote something or reply to something.</p>
        ) : (
          <ul className="karma-list">
            {events.map((e, i) => (
              <li key={i}>
                <span className="karma-delta">+{e.delta}</span>
                <span className="karma-what">{describe(e)}</span>
                <span className="karma-when">{formatDateShortTbilisi(e.created_at)} {formatTimeTbilisi(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
