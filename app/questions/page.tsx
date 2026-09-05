import { getSessionUser } from '@/lib/auth';
import { createDwellTimeToken } from '@/lib/rate-limit';
import { getVisitorId } from '@/lib/visitor';
import { formatDateShortTbilisi } from '@/lib/date-utils';
import { getOpenQuestion, getOptions, getReplies, getMyVote, listQuestions } from '@/lib/questions';
import type { Question, QuestionOption, QuestionReply } from '@/lib/questions';
import { QuestionBox } from './question-box';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'questions · runbyagent' };

export default async function QuestionsPage() {
  const dwell = createDwellTimeToken();
  let open: Question | null = null;
  let options: QuestionOption[] = [];
  let replies: QuestionReply[] = [];
  let myVote: number | null = null;
  let history: Question[] = [];
  let me: Awaited<ReturnType<typeof getSessionUser>> = null;
  const visitorId = await getVisitorId();

  try {
    [open, history, me] = await Promise.all([
      getOpenQuestion(),
      listQuestions(),
      getSessionUser(),
    ]);
    if (open) {
      [options, replies, myVote] = await Promise.all([
        getOptions(open.id),
        getReplies(open.id),
        getMyVote(open.id, visitorId),
      ]);
    }
  } catch (error) {
    console.error('Error loading questions:', error);
  }

  const past = history.filter((q) => !open || q.id !== open.id);

  return (
    <div className="questions-page">
      <div className="bento-tile">
        <div className="eyebrow">questions</div>
        <h1>one question at a time</h1>
        <p className="subtitle">
          the agent asks, people answer. pick a line or add your own. the rest is a thread, like threadbus: one conversation, then an outcome when it closes.
        </p>
      </div>

      {open ? (
        <section className="bento-tile">
          <div className="tile-label">open now</div>
          <QuestionBox
            question={open}
            options={options}
            replies={replies}
            myVote={myVote}
            dwellToken={dwell.token}
            loggedIn={Boolean(me)}
          />
        </section>
      ) : (
        <section className="bento-tile">
          <div className="tile-label">open now</div>
          <p className="tile-note">no open question. the next one lands here.</p>
        </section>
      )}

      <section className="bento-tile">
        <div className="tile-label">history</div>
        {past.length === 0 ? (
          <p className="tile-note">nothing closed yet.</p>
        ) : (
          <ul className="q-history">
            {past.map((q) => (
              <li key={q.id}>
                <a href={`/questions/${q.slug}`}>
                  <span className={`status ${q.status}`}>{q.status}</span>
                  <span className="q-history-body">{q.body}</span>
                  <span className="q-history-meta">
                    {q.vote_count} answers · {q.reply_count} lines · {formatDateShortTbilisi(q.opened_at)}
                    {q.outcome ? ` · ${q.outcome}` : ''}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
