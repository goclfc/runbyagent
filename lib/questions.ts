import { query } from './db';

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

export interface Question {
  id: number;
  slug: string;
  body: string;
  status: 'open' | 'closed';
  outcome: string | null;
  opened_at: string;
  closed_at: string | null;
  vote_count: number;
  reply_count: number;
}

export interface QuestionOption {
  id: number;
  body: string;
  kind: 'preset' | 'custom';
  author: string | null;
  sort: number;
  votes: number;
}

export interface QuestionReply {
  id: number;
  option_id: number | null;
  author: string | null;
  body: string;
  created_at: string;
}

export async function getOpenQuestion(): Promise<Question | null> {
  const rows = await query<Question>(
    `SELECT q.id, q.slug, q.body, q.status, q.outcome, q.opened_at, q.closed_at,
            (SELECT COUNT(*)::int FROM question_votes v WHERE v.question_id = q.id) AS vote_count,
            (SELECT COUNT(*)::int FROM question_replies r WHERE r.question_id = q.id) AS reply_count
     FROM questions q
     WHERE q.status = 'open'
     LIMIT 1`
  );
  return rows[0] || null;
}

export async function getQuestionBySlug(slug: string): Promise<Question | null> {
  const rows = await query<Question>(
    `SELECT q.id, q.slug, q.body, q.status, q.outcome, q.opened_at, q.closed_at,
            (SELECT COUNT(*)::int FROM question_votes v WHERE v.question_id = q.id) AS vote_count,
            (SELECT COUNT(*)::int FROM question_replies r WHERE r.question_id = q.id) AS reply_count
     FROM questions q
     WHERE q.slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

export async function listQuestions(): Promise<Question[]> {
  return query<Question>(
    `SELECT q.id, q.slug, q.body, q.status, q.outcome, q.opened_at, q.closed_at,
            (SELECT COUNT(*)::int FROM question_votes v WHERE v.question_id = q.id) AS vote_count,
            (SELECT COUNT(*)::int FROM question_replies r WHERE r.question_id = q.id) AS reply_count
     FROM questions q
     ORDER BY q.status ASC, q.opened_at DESC`
  );
}

export async function getOptions(questionId: number): Promise<QuestionOption[]> {
  return query<QuestionOption>(
    `SELECT o.id, o.body, o.kind, o.author, o.sort,
            (SELECT COUNT(*)::int FROM question_votes v WHERE v.option_id = o.id) AS votes
     FROM question_options o
     WHERE o.question_id = $1
     ORDER BY o.kind ASC, o.sort ASC, o.id ASC`,
    [questionId]
  );
}

export async function getReplies(questionId: number, limit?: number): Promise<QuestionReply[]> {
  const sql = limit
    ? `SELECT id, option_id, author, body, created_at
       FROM question_replies
       WHERE question_id = $1
       ORDER BY id DESC
       LIMIT $2`
    : `SELECT id, option_id, author, body, created_at
       FROM question_replies
       WHERE question_id = $1
       ORDER BY id ASC`;
  const rows = await query<QuestionReply>(sql, limit ? [questionId, limit] : [questionId]);
  return limit ? rows.reverse() : rows;
}

export async function getMyVote(questionId: number, visitorId?: string): Promise<number | null> {
  if (!visitorId) return null;
  const rows = await query<{ option_id: number }>(
    'SELECT option_id FROM question_votes WHERE question_id = $1 AND visitor_id = $2',
    [questionId, visitorId]
  );
  return rows[0]?.option_id ?? null;
}
