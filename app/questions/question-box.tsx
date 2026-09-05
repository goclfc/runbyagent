'use client';

import { useState } from 'react';
import { formatDateMonthDayTbilisi, formatTimeTbilisi } from '@/lib/date-utils';
import type { Question, QuestionOption, QuestionReply } from '@/lib/questions';

interface Props {
  question: Question;
  options: QuestionOption[];
  replies: QuestionReply[];
  myVote: number | null;
  dwellToken: string;
  compact?: boolean;
  loggedIn?: boolean;
}

export function QuestionBox({
  question,
  options,
  replies,
  myVote,
  dwellToken,
  compact = false,
  loggedIn = false,
}: Props) {
  const [opts, setOpts] = useState(options);
  const [thread, setThread] = useState(replies);
  const [vote, setVote] = useState<number | null>(myVote);
  const [votes, setVotes] = useState(question.vote_count);
  const [custom, setCustom] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = question.status === 'closed';

  const preset = opts.filter((o) => o.kind === 'preset');
  const added = opts.filter((o) => o.kind === 'custom');
  const shownThread = compact ? thread.slice(-3) : thread;

  async function sendVote(payload: Record<string, unknown>) {
    if (closed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${question.slug}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, t0: dwellToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'could not save that');
        return;
      }
      setOpts(data.options);
      setThread(data.replies);
      setVote(data.my_vote);
      setVotes(data.question.vote_count);
      setCustom('');
    } catch {
      setError('could not save that');
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (closed || busy || !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${question.slug}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim(), t0: dwellToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'could not post');
        return;
      }
      setThread(data.replies);
      setReply('');
    } catch {
      setError('could not post');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? 'qbox qbox-compact' : 'qbox'}>
      <p className="qbox-body">{question.body}</p>
      <p className="qbox-meta">
        {question.status === 'open' ? 'open' : 'closed'} · {votes} {votes === 1 ? 'answer' : 'answers'} · {thread.length} {thread.length === 1 ? 'line' : 'lines'}
      </p>

      <div className="qbox-options" role="group" aria-label="possible answers">
        {preset.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`qbox-option${vote === option.id ? ' is-mine' : ''}`}
            disabled={closed || busy}
            onClick={() => sendVote({ option_id: option.id })}
          >
            <span>{option.body}</span>
            <span className="qbox-count">{option.votes}</span>
          </button>
        ))}
        {added.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`qbox-option qbox-option-custom${vote === option.id ? ' is-mine' : ''}`}
            disabled={closed || busy}
            onClick={() => sendVote({ option_id: option.id })}
          >
            <span>{option.body}</span>
            <span className="qbox-count">{option.votes}</span>
          </button>
        ))}
      </div>

      {!closed && (
        <form
          className="qbox-add"
          onSubmit={(event) => {
            event.preventDefault();
            if (custom.trim()) sendVote({ body: custom.trim() });
          }}
        >
          <label className="sr-only" htmlFor={`q-add-${question.slug}`}>add your own</label>
          <input
            id={`q-add-${question.slug}`}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="add your own"
            maxLength={200}
            disabled={busy}
          />
          <input type="text" name="website" className="hp" tabIndex={-1} autoComplete="off" />
          <button type="submit" className="btn" disabled={busy || !custom.trim()}>add</button>
        </form>
      )}

      <ol className="qbox-thread">
        {shownThread.map((line) => (
          <li key={line.id}>
            <div className="qbox-thread-meta">
              <span className="chip chip-muted">{line.author || 'anon'}</span>
              <span className="log-time">{formatDateMonthDayTbilisi(line.created_at)} {formatTimeTbilisi(line.created_at)}</span>
            </div>
            <p>{line.body}</p>
          </li>
        ))}
        {shownThread.length === 0 && (
          <li className="tile-note">no replies yet. pick an answer or add yours.</li>
        )}
      </ol>

      {!closed && !compact && (
        <form
          className="qbox-reply"
          onSubmit={(event) => {
            event.preventDefault();
            sendReply();
          }}
        >
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={loggedIn ? 'continue the thread' : 'continue the thread. log in to put your name on it.'}
            maxLength={2000}
            rows={3}
            disabled={busy}
          />
          <input type="text" name="website" className="hp" tabIndex={-1} autoComplete="off" />
          <button type="submit" className="btn" disabled={busy || !reply.trim()}>reply</button>
        </form>
      )}

      {question.outcome && (
        <p className="qbox-outcome">outcome: {question.outcome}</p>
      )}

      {error && <p className="qbox-error">{error}</p>}

      {compact && (
        <a href={`/questions/${question.slug}`} className="more-link">the thread →</a>
      )}
    </div>
  );
}
