'use client';

import { useState } from 'react';
import type { QuestionDetail } from '@/lib/questions';

const WRITEIN_MAX = 200;

interface Props {
  detail: QuestionDetail;
  loggedIn: boolean;
  /** landing tile: options and a link, no write-in form */
  compact?: boolean;
}

function closesIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'closing';
  const hours = Math.round(ms / 3600000);
  if (hours < 1) return 'closes in under an hour';
  if (hours < 48) return `closes in ${hours}h`;
  return `closes in ${Math.round(hours / 24)}d`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function QuestionPoll({ detail: initial, loggedIn, compact = false }: Props) {
  const [detail, setDetail] = useState<QuestionDetail>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [draft, setDraft] = useState('');
  const [added, setAdded] = useState(false);

  const { question, results, writeins, my_vote, my_writein_upvotes } = detail;
  const open = question.status === 'open';
  const base = `/api/questions/${question.slug}`;
  const loginHref = `/login?return=${encodeURIComponent(`/questions/${question.slug}`)}`;

  async function call(path: string, body?: unknown): Promise<boolean> {
    setError(null);
    setNeedLogin(false);
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401) {
      setNeedLogin(true);
      return false;
    }
    if (!res.ok) {
      setError(data?.error || 'Something went wrong. Try again.');
      return false;
    }
    if (data?.question) setDetail(data as QuestionDetail);
    return true;
  }

  async function vote(optionId: number) {
    if (!open || busy) return;
    if (!loggedIn) {
      setNeedLogin(true);
      return;
    }
    setBusy(`vote:${optionId}`);
    await call(`${base}/vote`, { option_id: optionId });
    setBusy(null);
  }

  async function upvote(writeinId: number) {
    if (!open || busy) return;
    if (!loggedIn) {
      setNeedLogin(true);
      return;
    }
    setBusy(`up:${writeinId}`);
    await call(`${base}/writeins/${writeinId}/upvote`);
    setBusy(null);
  }

  async function submitWritein(event: React.FormEvent) {
    event.preventDefault();
    if (!open || busy) return;
    const text = draft.trim();
    if (!text) return;
    setBusy('writein');
    const ok = await call(`${base}/writeins`, { body: text });
    if (ok) {
      setDraft('');
      setAdded(true);
    }
    setBusy(null);
  }

  const summary = open
    ? `${plural(results.total, 'vote', 'votes')} · ${closesIn(question.closes_at)}`
    : `${plural(results.total, 'vote', 'votes')} · ${question.status === 'decided' ? 'decided' : 'closed'}`;

  return (
    <div className={`qpoll${compact ? ' qpoll-compact' : ''}`}>
      <ol className="qpoll-options">
        {results.options.map((option) => {
          const mine = my_vote === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                className={`qpoll-option${mine ? ' is-mine' : ''}${open ? '' : ' is-closed'}`}
                onClick={() => vote(option.id)}
                disabled={!open || busy !== null}
                aria-pressed={mine}
                title={open ? (mine ? 'Your vote' : 'Vote for this') : 'Voting has closed'}
              >
                <span className="qpoll-bar" style={{ width: `${option.share}%` }} aria-hidden="true" />
                <span className="qpoll-option-label">{option.label}</span>
                <span className="qpoll-option-num">
                  {option.share}%
                  {!compact && <span className="qpoll-option-count"> · {option.total}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="qpoll-summary">
        {summary}
        {results.x_total > 0 && (
          <>
            {' '}· {results.site_total} here, {results.x_total} on{' '}
            {question.x_post_url ? (
              <a href={question.x_post_url} target="_blank" rel="noopener noreferrer">X</a>
            ) : 'X'}
          </>
        )}
        {results.x_total === 0 && question.x_post_url && (
          <>
            {' '}· <a href={question.x_post_url} target="_blank" rel="noopener noreferrer">also on X</a>
          </>
        )}
      </p>

      {needLogin && (
        <p className="qpoll-note">
          <a href={loginHref}>Log in</a> or <a href={`/register?return=${encodeURIComponent(`/questions/${question.slug}`)}`}>register</a> to vote. It takes ten seconds.
        </p>
      )}
      {error && <p className="qpoll-error">{error}</p>}

      {compact ? (
        <a href={`/questions/${question.slug}`} className="more-link">
          {writeins.length > 0 ? `${plural(writeins.length, 'other answer', 'other answers')} · add yours →` : 'add yours →'}
        </a>
      ) : (
        <div className="qpoll-writeins">
          <h3 className="qpoll-h">
            Other answers
            {writeins.length > 0 && <span className="qpoll-h-count">{writeins.length}</span>}
          </h3>
          {writeins.length === 0 ? (
            <p className="qpoll-note">Nobody has added one yet. {open ? 'Yours would be first.' : ''}</p>
          ) : (
            <ul className="qpoll-writein-list">
              {writeins.map((w) => {
                const upvoted = my_writein_upvotes.includes(w.id);
                return (
                  <li key={w.id} className="qpoll-writein">
                    <button
                      type="button"
                      className={`qpoll-up${upvoted ? ' is-up' : ''}`}
                      onClick={() => upvote(w.id)}
                      disabled={!open || upvoted || busy !== null}
                      title={upvoted ? 'You upvoted this' : open ? 'Upvote, gives the author a karma point' : 'Voting has closed'}
                      aria-label={`Upvote, ${w.karma} so far`}
                    >
                      ▲ {w.karma}
                    </button>
                    <div className="qpoll-writein-body">
                      <p>{w.body}</p>
                      <p className="qpoll-writein-meta">
                        <a href={`/u/${w.username}`}>{w.username}</a>
                        {w.promoted_option_id && <span className="chip">now an option</span>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {open && (
            loggedIn ? (
              <form className="qpoll-form" onSubmit={submitWritein}>
                <label htmlFor="writein" className="qpoll-label">Add yours</label>
                <div className="qpoll-form-row">
                  <input
                    id="writein"
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, WRITEIN_MAX))}
                    placeholder="A different answer, in one line"
                    maxLength={WRITEIN_MAX}
                    disabled={busy !== null}
                  />
                  <button type="submit" className="btn btn-primary" disabled={busy !== null || draft.trim().length === 0}>
                    {busy === 'writein' ? 'Adding…' : 'Add'}
                  </button>
                </div>
                <p className="qpoll-note">
                  {draft.length}/{WRITEIN_MAX}. {added ? 'Added. Others can upvote it, and it can become an option.' : 'Good ones get promoted into the poll.'}
                </p>
              </form>
            ) : (
              <p className="qpoll-note">
                <a href={loginHref}>Log in</a> to add your own answer or upvote one.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
