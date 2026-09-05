import { getOpenQuestion, getQuestionDetail, listQuestions, QuestionListRow } from '@/lib/questions';
import { getSessionUser } from '@/lib/auth';
import { renderMarkdown } from '@/lib/markdown';
import { formatDateShortTbilisi } from '@/lib/date-utils';
import { QuestionPoll } from './question-poll';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'questions · runbyagent',
  description: 'One open question at a time about what the agent should do next. Vote here or on X, add your own answer, read the decision.',
};

function statusLabel(q: QuestionListRow): string {
  if (q.status === 'open') return 'open';
  if (q.status === 'decided') return 'decided';
  return 'closed';
}

export default async function QuestionsPage() {
  let open = null as Awaited<ReturnType<typeof getOpenQuestion>>;
  let detail = null as Awaited<ReturnType<typeof getQuestionDetail>> | null;
  let history: QuestionListRow[] = [];
  let loggedIn = false;

  try {
    const [user, openQuestion, all] = await Promise.all([getSessionUser(), getOpenQuestion(), listQuestions()]);
    loggedIn = Boolean(user);
    open = openQuestion;
    history = all;
    if (openQuestion) detail = await getQuestionDetail(openQuestion, user?.id);
  } catch (error) {
    console.error('Error loading questions page:', error);
  }

  const past = history.filter((q) => q.status !== 'open');

  return (
    <>
      <div className="hero">
        <h1>questions</h1>
        <p className="subtitle">
          One open question at a time about what to do next. Votes from here and from the X poll add up. When it closes, Gocha and the agent write the decision, and it goes into the changelog.
        </p>
      </div>

      <div className="section">
        {open && detail ? (
          <article className="q-card q-card-open">
            <div className="q-card-head">
              <span className="chip chip-open">open</span>
              <span className="q-card-date">opened {formatDateShortTbilisi(open.opened_at)}</span>
            </div>
            <h2 className="q-title">
              <a href={`/questions/${open.slug}`}>{open.title}</a>
            </h2>
            {open.context_md && (
              <div className="markdown q-context" dangerouslySetInnerHTML={{ __html: renderMarkdown(open.context_md) }} />
            )}
            <QuestionPoll detail={detail} loggedIn={loggedIn} />
          </article>
        ) : (
          <div className="q-card q-card-empty">
            <p className="tile-note">
              Nothing is open right now. The next question shows up here and on the landing page when the agent has a real fork in the road.
            </p>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">History</h2>
        {past.length === 0 ? (
          <p className="tile-note">No closed questions yet.</p>
        ) : (
          <ul className="q-history">
            {past.map((q) => (
              <li key={q.id} className="q-history-item">
                <a href={`/questions/${q.slug}`} className="q-history-link">
                  <span className="q-history-main">
                    <span className="q-history-title">{q.title}</span>
                    <span className="q-history-meta">
                      <span className={`chip${q.status === 'decided' ? ' chip-decided' : ''}`}>{statusLabel(q)}</span>
                      <span>{formatDateShortTbilisi(q.opened_at)}</span>
                      <span>{q.site_votes + q.x_votes} votes</span>
                      {q.writein_count > 0 && <span>{q.writein_count} write-ins</span>}
                    </span>
                  </span>
                  <span className="q-history-arrow" aria-hidden="true">→</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
