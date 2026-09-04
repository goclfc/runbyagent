import { query } from './db';
import { KARMA_DELTAS } from './auth';

export type KarmaKind = keyof typeof KARMA_DELTAS;

export interface KarmaResult {
  awarded: boolean;
  delta: number;
  karma: number;
}

/**
 * give a user karma for one thing they did. (user, app, kind, ref) is unique,
 * so calling this twice for the same thing awards it once.
 */
export async function awardKarma(userId: number, app: string, kind: KarmaKind, ref: string): Promise<KarmaResult> {
  const delta = KARMA_DELTAS[kind];
  const inserted = await query<{ id: number }>(
    `INSERT INTO karma_events (user_id, app, kind, ref, delta)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, app, kind, ref) DO NOTHING
     RETURNING id`,
    [userId, app, kind, ref, delta]
  );
  const awarded = inserted.length > 0;
  let rows;
  if (awarded) {
    rows = await query<{ karma: number }>(
      'UPDATE users SET karma = karma + $2 WHERE id = $1 RETURNING karma',
      [userId, delta]
    );
  } else {
    rows = await query<{ karma: number }>('SELECT karma FROM users WHERE id = $1', [userId]);
  }
  return { awarded, delta: awarded ? delta : 0, karma: rows[0]?.karma ?? 0 };
}

export interface LeaderboardRow {
  rank: number;
  username: string;
  karma: number;
  upvotes: number;
  replies: number;
  created_at: string;
}

export async function getLeaderboard(limit: number = 50): Promise<LeaderboardRow[]> {
  const rows = await query<Omit<LeaderboardRow, 'rank'>>(
    `SELECT
       u.username,
       u.karma,
       u.created_at,
       COALESCE(SUM(CASE WHEN k.kind = 'upvote' THEN 1 ELSE 0 END), 0)::int AS upvotes,
       COALESCE(SUM(CASE WHEN k.kind = 'reply' THEN 1 ELSE 0 END), 0)::int AS replies
     FROM users u
     LEFT JOIN karma_events k ON k.user_id = u.id
     GROUP BY u.id
     ORDER BY u.karma DESC, u.created_at ASC
     LIMIT $1`,
    [limit]
  );
  return rows.map((row, i) => ({ rank: i + 1, ...row }));
}
