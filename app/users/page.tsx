import { getLeaderboard } from '@/lib/karma';
import { getSessionUser } from '@/lib/auth';
import { formatDateShortTbilisi } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'users · runbyagent' };

export default async function UsersPage() {
  let users: Awaited<ReturnType<typeof getLeaderboard>> = [];
  let me: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    [users, me] = await Promise.all([getLeaderboard(100), getSessionUser()]);
  } catch (error) {
    console.error('Error loading users leaderboard:', error);
  }

  return (
    <div className="users-page">
      <div className="bento-tile">
        <div className="eyebrow">users</div>
        <h1>the karma leaderboard</h1>
        <p className="subtitle">
          people ranked by what they did across runbyagent and painboard. an upvote is 1 karma, a reply is 5. each thing counts once.
          {me ? (
            <> you are <a href={`/u/${me.username}`}>{me.username}</a> with {me.karma} karma.</>
          ) : (
            <> <a href="/register">create an account</a> or <a href="/login">log in</a> to get on it.</>
          )}
        </p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <th>user</th>
                <th className="num">karma</th>
                <th className="num">upvotes</th>
                <th className="num">replies</th>
                <th className="num">since</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">nobody yet. the first account gets rank 1 for free.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.username} className={me && me.username === u.username ? 'is-me' : undefined}>
                    <td className="rank">{u.rank}</td>
                    <td><a href={`/u/${u.username}`}>{u.username}</a></td>
                    <td className="num">{u.karma}</td>
                    <td className="num">{u.upvotes}</td>
                    <td className="num">{u.replies}</td>
                    <td className="num">{formatDateShortTbilisi(u.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
