import { query } from './db';

/**
 * open questions. one is open at a time, it has 2 to 4 options, people vote on the site and on x,
 * both counts add up. write-ins collect karma upvotes and can be promoted into an option.
 * when the question closes gocha and the agent write a decision, which also lands in the changelog.
 */

export type QuestionStatus = 'open' | 'closed' | 'decided';

export interface Question {
  id: number;
  slug: string;
  title: string;
  context_md: string;
  status: QuestionStatus;
  x_post_id: string | null;
  x_post_url: string | null;
  opened_at: string;
  closes_at: string;
  decided_at: string | null;
  decision_md: string | null;
  decision_log_id: number | null;
  x_synced_at: string | null;
  created_at: string;
}

export interface QuestionOption {
  id: number;
  question_id: number;
  position: number;
  label: string;
  x_votes: number;
}

export interface OptionResult extends QuestionOption {
  site_votes: number;
  total: number;
  share: number;
}

export interface QuestionResults {
  options: OptionResult[];
  site_total: number;
  x_total: number;
  total: number;
}

export interface Writein {
  id: number;
  question_id: number;
  user_id: number;
  username: string;
  body: string;
  karma: number;
  promoted_option_id: number | null;
  created_at: string;
}

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
export const DEFAULT_CLOSES_IN_HOURS = 48;
export const MIN_CLOSES_IN_HOURS = 24;
export const MAX_CLOSES_IN_HOURS = 168;
export const TITLE_MAX = 140;
export const OPTION_MAX = 60;
export const WRITEIN_MAX = 200;
export const RESERVED_SLUGS = new Set(['current']);

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80 && !RESERVED_SLUGS.has(slug);
}

/** an x post url or id. accepts x.com / twitter.com status links and bare numeric ids. */
export function parseXPost(input: unknown): { id: string; url: string } | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;
  if (/^\d{5,25}$/.test(value)) {
    return { id: value, url: `https://x.com/i/status/${value}` };
  }
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\.|^mobile\./, '');
    if (host !== 'x.com' && host !== 'twitter.com') return null;
    const match = url.pathname.match(/\/status\/(\d{5,25})/);
    if (!match) return null;
    return { id: match[1], url: `https://x.com${url.pathname.replace(/\/+$/, '')}` };
  } catch {
    return null;
  }
}

export function cleanOptions(input: unknown): { labels: string[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'options must be an array of labels' };
  const labels = input
    .map((o) => (typeof o === 'string' ? o : typeof o?.label === 'string' ? o.label : ''))
    .map((s: string) => s.trim());
  if (labels.length < MIN_OPTIONS || labels.length > MAX_OPTIONS) {
    return { error: `a question needs ${MIN_OPTIONS} to ${MAX_OPTIONS} options` };
  }
  if (labels.some((l) => l.length === 0)) return { error: 'every option needs a label' };
  if (labels.some((l) => l.length > OPTION_MAX)) return { error: `option labels must be ${OPTION_MAX} characters or less` };
  const lower = labels.map((l) => l.toLowerCase());
  if (new Set(lower).size !== lower.length) return { error: 'options must be different from each other' };
  return { labels };
}

export function cleanClosesIn(input: unknown): number | { error: string } {
  if (input === undefined || input === null || input === '') return DEFAULT_CLOSES_IN_HOURS;
  const hours = Number(input);
  if (!Number.isFinite(hours) || hours < MIN_CLOSES_IN_HOURS || hours > MAX_CLOSES_IN_HOURS) {
    return { error: `closes_in_hours must be between ${MIN_CLOSES_IN_HOURS} and ${MAX_CLOSES_IN_HOURS}` };
  }
  return hours;
}

/** admin routes take a numeric id or a slug in the :id segment. */
export async function findQuestionByIdOrSlug(idOrSlug: string): Promise<Question | null> {
  if (/^\d+$/.test(idOrSlug)) return getQuestionById(Number(idOrSlug));
  return getQuestionBySlug(idOrSlug);
}

// ---- reads ----

/** flips an open question to closed once closes_at has passed. runs on every read, so nothing needs a timer. */
export async function autoClose(): Promise<void> {
  await query(`UPDATE questions SET status = 'closed' WHERE status = 'open' AND closes_at <= NOW()`);
}

export async function getOpenQuestion(): Promise<Question | null> {
  await autoClose();
  const rows = await query<Question>(`SELECT * FROM questions WHERE status = 'open' LIMIT 1`);
  return rows[0] || null;
}

export async function getQuestionBySlug(slug: string): Promise<Question | null> {
  await autoClose();
  const rows = await query<Question>('SELECT * FROM questions WHERE slug = $1', [slug]);
  return rows[0] || null;
}

export async function getQuestionById(id: number): Promise<Question | null> {
  await autoClose();
  const rows = await query<Question>('SELECT * FROM questions WHERE id = $1', [id]);
  return rows[0] || null;
}

/** the most recent question that has a decision, for the landing tile when nothing is open. */
export async function getLastDecided(): Promise<Question | null> {
  const rows = await query<Question>(
    `SELECT * FROM questions WHERE status = 'decided' ORDER BY decided_at DESC NULLS LAST, opened_at DESC LIMIT 1`
  );
  return rows[0] || null;
}

export interface QuestionListRow extends Question {
  site_votes: number;
  x_votes: number;
  writein_count: number;
}

export async function listQuestions(): Promise<QuestionListRow[]> {
  await autoClose();
  return query<QuestionListRow>(`
    SELECT q.*,
      (SELECT COUNT(*)::int FROM question_votes v WHERE v.question_id = q.id) AS site_votes,
      (SELECT COALESCE(SUM(o.x_votes), 0)::int FROM question_options o WHERE o.question_id = q.id) AS x_votes,
      (SELECT COUNT(*)::int FROM question_writeins w WHERE w.question_id = q.id) AS writein_count
    FROM questions q
    ORDER BY q.opened_at DESC
  `);
}

export async function getOptions(questionId: number): Promise<QuestionOption[]> {
  return query<QuestionOption>(
    'SELECT * FROM question_options WHERE question_id = $1 ORDER BY position ASC',
    [questionId]
  );
}

/** shares are integers that add up to 100 (largest remainder), or all zero when nobody has voted. */
export function computeShares(totals: number[]): number[] {
  const sum = totals.reduce((a, b) => a + b, 0);
  if (sum === 0) return totals.map(() => 0);
  const exact = totals.map((t) => (t * 100) / sum);
  const floors = exact.map((e) => Math.floor(e));
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return floors;
}

export async function getResults(questionId: number): Promise<QuestionResults> {
  const rows = await query<QuestionOption & { site_votes: number }>(
    `SELECT o.*, (SELECT COUNT(*)::int FROM question_votes v WHERE v.option_id = o.id) AS site_votes
     FROM question_options o
     WHERE o.question_id = $1
     ORDER BY o.position ASC`,
    [questionId]
  );
  const totals = rows.map((r) => r.site_votes + r.x_votes);
  const shares = computeShares(totals);
  const options: OptionResult[] = rows.map((r, i) => ({
    ...r,
    total: totals[i],
    share: shares[i],
  }));
  const site_total = rows.reduce((n, r) => n + r.site_votes, 0);
  const x_total = rows.reduce((n, r) => n + r.x_votes, 0);
  return { options, site_total, x_total, total: site_total + x_total };
}

export async function getWriteins(questionId: number): Promise<Writein[]> {
  return query<Writein>(
    `SELECT w.*, u.username
     FROM question_writeins w
     JOIN users u ON u.id = w.user_id
     WHERE w.question_id = $1
     ORDER BY w.karma DESC, w.created_at ASC`,
    [questionId]
  );
}

export async function getMyVote(questionId: number, userId: number | null | undefined): Promise<number | null> {
  if (!userId) return null;
  const rows = await query<{ option_id: number }>(
    'SELECT option_id FROM question_votes WHERE question_id = $1 AND user_id = $2',
    [questionId, userId]
  );
  return rows[0]?.option_id ?? null;
}

/** write-in ids the user already upvoted, so the ui can mark them. */
export async function getMyWriteinUpvotes(questionId: number, userId: number | null | undefined): Promise<number[]> {
  if (!userId) return [];
  const rows = await query<{ ref: string }>(
    `SELECT ref FROM karma_events
     WHERE kind = 'writein_upvote' AND app = 'runbyagent' AND ref LIKE $1 AND ref LIKE $2`,
    [`q${questionId}:writein:%`, `%:by:${userId}`]
  );
  return rows
    .map((r) => Number(r.ref.split(':')[2]))
    .filter((n) => Number.isInteger(n));
}

export function writeinUpvoteRef(questionId: number, writeinId: number, voterId: number): string {
  return `q${questionId}:writein:${writeinId}:by:${voterId}`;
}

export interface QuestionDetail {
  question: Question;
  results: QuestionResults;
  writeins: Writein[];
  my_vote: number | null;
  my_writein_upvotes: number[];
}

/** everything a page or the api needs to show one question. */
export async function getQuestionDetail(question: Question, userId: number | null | undefined): Promise<QuestionDetail> {
  const [results, writeins, my_vote, my_writein_upvotes] = await Promise.all([
    getResults(question.id),
    getWriteins(question.id),
    getMyVote(question.id, userId),
    getMyWriteinUpvotes(question.id, userId),
  ]);
  return { question, results, writeins, my_vote, my_writein_upvotes };
}

// ---- x poll sync ----

export interface XPollSnapshot {
  options: Array<{ position: number; label: string; votes: number }>;
  voting_status?: string;
  end_datetime?: string;
}

export function xApiBase(): string {
  return process.env.X_API_BASE || 'https://api.x.com';
}

/** fetch the poll attached to an x post. returns null when the post has no poll or the api says no. */
export async function fetchXPoll(postId: string): Promise<XPollSnapshot | null> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error('X_BEARER_TOKEN is not set');
  const url = `${xApiBase()}/2/tweets/${encodeURIComponent(postId)}?expansions=attachments.poll_ids&poll.fields=options,voting_status,end_datetime`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'runbyagent/1.0' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`x api returned ${response.status}`);
  }
  const data = await response.json();
  const poll = data?.includes?.polls?.[0];
  if (!poll || !Array.isArray(poll.options)) return null;
  return {
    options: poll.options.map((o: { position: number; label: string; votes: number }) => ({
      position: Number(o.position),
      label: String(o.label ?? ''),
      votes: Number(o.votes) || 0,
    })),
    voting_status: poll.voting_status,
    end_datetime: poll.end_datetime,
  };
}

/** write x poll counts onto the question's options, matched by position. */
export async function applyXPoll(questionId: number, poll: XPollSnapshot): Promise<{ updated: number; x_total: number }> {
  let updated = 0;
  let x_total = 0;
  for (const option of poll.options) {
    if (!Number.isInteger(option.position) || option.position < 1 || option.position > MAX_OPTIONS) continue;
    const votes = Math.max(0, Math.floor(option.votes || 0));
    const rows = await query(
      'UPDATE question_options SET x_votes = $3 WHERE question_id = $1 AND position = $2 RETURNING id',
      [questionId, option.position, votes]
    );
    if (rows.length > 0) {
      updated += 1;
      x_total += votes;
    }
  }
  await query('UPDATE questions SET x_synced_at = NOW() WHERE id = $1', [questionId]);
  return { updated, x_total };
}

// ---- decision text for the changelog ----

export function firstChars(markdown: string, limit: number): string {
  const flat = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= limit) return flat;
  return flat.slice(0, limit).replace(/\s+\S*$/, '') + '…';
}

export function decisionLogBody(question: Question, decisionMd: string, results: QuestionResults, writeins: Writein[]): string {
  const head = `decision: ${question.title} — ${firstChars(decisionMd, 200)}`;
  const tally = results.options
    .map((o) => `${o.label} ${o.total} (${o.share}%)`)
    .join(', ');
  const lines = [head, `Results: ${tally}. ${results.total} votes, ${results.site_total} on the site and ${results.x_total} on X.`];
  const top = writeins.slice(0, 3).map((w) => `@${w.username}`);
  if (top.length > 0) {
    lines.push(`Write-ins: ${top.join(', ')}.`);
  }
  return lines.join('\n\n');
}

export function hoursUntil(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 3600000));
}

export function formatClosesIn(iso: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return 'closing';
  const hours = Math.round(ms / 3600000);
  if (hours < 1) return 'closes in under an hour';
  if (hours < 48) return `closes in ${hours}h`;
  const days = Math.round(hours / 24);
  return `closes in ${days}d`;
}
