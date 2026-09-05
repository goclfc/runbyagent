import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { createDwellTimeToken } from '@/lib/rate-limit';
import { getVisitorId } from '@/lib/visitor';
import { getQuestionBySlug, getOptions, getReplies, getMyVote } from '@/lib/questions';
import { QuestionBox } from '../question-box';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const question = await getQuestionBySlug(slug);
    if (!question) return { title: 'question · runbyagent' };
    return { title: `${question.body.slice(0, 60)} · runbyagent` };
  } catch {
    return { title: 'question · runbyagent' };
  }
}

export default async function QuestionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dwell = createDwellTimeToken();
  const visitorId = await getVisitorId();

  let question = null;
  try {
    question = await getQuestionBySlug(slug);
  } catch (error) {
    console.error('Error loading question:', error);
  }
  if (!question) notFound();

  const [options, replies, myVote, me] = await Promise.all([
    getOptions(question.id),
    getReplies(question.id),
    getMyVote(question.id, visitorId),
    getSessionUser(),
  ]);

  return (
    <div className="questions-page">
      <div className="bento-tile">
        <p className="eyebrow"><a href="/questions">questions</a> / thread</p>
        <h1>{question.status === 'open' ? 'open question' : 'closed question'}</h1>
        <p className="subtitle">
          pick a possible answer or add yours. replies stay in this thread. when it closes, the outcome line is what remains.
        </p>
        <QuestionBox
          question={question}
          options={options}
          replies={replies}
          myVote={myVote}
          dwellToken={dwell.token}
          loggedIn={Boolean(me)}
        />
      </div>
    </div>
  );
}
