import { notFound } from 'next/navigation';
import { getQuestionBySlug, getQuestionDetail } from '@/lib/questions';
import { getSessionUser } from '@/lib/auth';
import { renderMarkdown } from '@/lib/markdown';
import { formatDateShortTbilisi, formatDateTbilisi, formatTimeTbilisi } from '@/lib/date-utils';
import { QuestionPoll } from '../question-poll';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const question = await getQuestionBySlug(slug);
    if (!question) return { title: 'question not found · runbyagent' };
    return {
      title: `${question.title} · runbyagent`,
      description: question.status === 'decided'
        ? `Decided. ${question.title}`
        : `Vote on the site or on X, add your own answer. ${question.title}`,
    };
  } catch {
    return { title: 'questions · runbyagent' };
  }
}

export default async function QuestionPage({ params }: Props) {
  const { slug } = await params;
  const [question, user] = await Promise.all([getQuestionBySlug(slug), getSessionUser()]);
  if (!question) notFound();
  const detail = await getQuestionDetail(question, user?.id);

  const statusChip = question.status === 'open' ? 'chip chip-open' : question.status === 'decided' ? 'chip chip-decided' : 'chip';
  const winner = detail.results.total > 0
    ? [...detail.results.options].sort((a, b) => b.total - a.total || a.position - b.position)[0]
    : null;

  return (
    <>
      <div className="hero q-hero">
        <p className="q-breadcrumb"><a href="/questions">questions</a> / {question.slug}</p>
        <h1 className="q-page-title">{question.title}</h1>
        <p className="q-page-meta">
          <span className={statusChip}>{question.status}</span>
          <span>opened {formatDateTbilisi(question.opened_at)} at {formatTimeTbilisi(question.opened_at)}</span>
          {question.status === 'open' ? (
            <span>closes {formatDateTbilisi(question.closes_at)} at {formatTimeTbilisi(question.closes_at)}</span>
          ) : (
            <span>closed {formatDateShortTbilisi(question.closes_at)}</span>
          )}
          {question.x_post_url && (
            <a href={question.x_post_url} target="_blank" rel="noopener noreferrer">the X poll →</a>
          )}
        </p>
      </div>

      {question.context_md && (
        <div className="section">
          <div className="markdown q-context" dangerouslySetInnerHTML={{ __html: renderMarkdown(question.context_md) }} />
        </div>
      )}

      <div className="section">
        <h2 className="section-title">{question.status === 'open' ? 'Vote' : 'Results'}</h2>
        {question.status !== 'open' && winner && (
          <p className="q-winner">
            Most votes: <b>{winner.label}</b>, {winner.total} of {detail.results.total} ({winner.share}%).
          </p>
        )}
        <QuestionPoll detail={detail} loggedIn={Boolean(user)} />
      </div>

      {question.status === 'decided' && question.decision_md && (
        <div className="section q-decision" id="decision">
          <h2 className="section-title">Decision</h2>
          <p className="q-decision-meta">
            by Gocha and the agent
            {question.decided_at && <>, {formatDateTbilisi(question.decided_at)}</>}
            {question.decision_log_id && (
              <>
                {' '}· <a href={`/changelog#${question.decision_log_id}`}>in the changelog →</a>
              </>
            )}
          </p>
          <div className="markdown q-decision-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(question.decision_md) }} />
        </div>
      )}

      {question.status === 'closed' && (
        <div className="section">
          <p className="tile-note">Voting has closed. The decision is being written and will show up here and in the changelog.</p>
        </div>
      )}
    </>
  );
}
