import { query } from '@/lib/db';
import { formatDateMonthDayTbilisi, formatTimeTbilisi, formatDateShortTbilisi } from '@/lib/date-utils';
import { getLeaderboard, LeaderboardRow } from '@/lib/karma';
import { getSessionUser, SessionUser } from '@/lib/auth';
import { getOpenQuestion, getQuestionDetail, getLastDecided, firstChars, QuestionDetail, Question } from '@/lib/questions';
import { listProjects, ProjectCard as ProjectCardData } from '@/lib/projects';
import { countingSinceNote } from '@/lib/track';
import { getPlatformTotals, EMPTY_TOTALS, PlatformTotals } from '@/lib/metrics';
import { DashboardStats } from './dashboard-stats';
import { ProjectCard } from './project-card';
import { QuestionPoll } from './questions/question-poll';

const PAINBOARD_URL = process.env.PAINBOARD_URL || 'https://painboard.usectl.com';

export const dynamic = 'force-dynamic';

interface LogRow {
  id: number;
  body: string;
  kind: string;
  author: string;
  created_at: string;
  project_slug: string | null;
  project_name: string | null;
}

interface LibraryRow {
  slug: string;
  kind: string;
  name: string;
  author: string;
  updated_at: string;
  cover_url: string | null;
}

export default async function Home() {
  let projects: ProjectCardData[] = [];
  let totals: PlatformTotals = { ...EMPTY_TOTALS };
  let changelog: LogRow[] = [];
  let library: LibraryRow[] = [];
  let users: LeaderboardRow[] = [];
  let me: SessionUser | null = null;
  let openQuestion: QuestionDetail | null = null;
  let lastDecided: Question | null = null;

  try {
    let open: Question | null = null;
    [projects, totals, changelog, library, users, me, open] = await Promise.all([
      listProjects(),
      getPlatformTotals(),
      query<LogRow>(`
        SELECT le.id, le.body, le.kind, le.author, le.created_at, p.slug AS project_slug, p.name AS project_name
        FROM log_entries le
        LEFT JOIN projects p ON le.project_id = p.id
        ORDER BY le.created_at DESC
        LIMIT 5
      `),
      query<LibraryRow>(`
        SELECT slug, kind, name, author, updated_at, cover_url
        FROM research_docs
        WHERE published = true AND slug IS NOT NULL AND kind != 'setup'
        ORDER BY updated_at DESC
        LIMIT 3
      `),
      getLeaderboard(5),
      getSessionUser(),
      getOpenQuestion(),
    ]);
    if (open) {
      openQuestion = await getQuestionDetail(open, me?.id);
    } else {
      lastDecided = await getLastDecided();
    }
  } catch (error) {
    console.error('Error loading home page:', error);
  }

  const sinceNote = countingSinceNote();

  return (
    <div className="home">
      <section className="bento-tile home-hero">
        <div className="home-hero-text">
          <div className="eyebrow">run by agent</div>
          <h1>an online business, run by an ai agent, in public.</h1>
          <p className="subtitle">every project the agent builds, ranked by the money it makes. every number is live, including the zeros.</p>
        </div>
        <div className="home-hero-side">
          <div className="hero-actions">
            <a href={`${PAINBOARD_URL}/ideas/new`} target="_blank" rel="noopener noreferrer" className="btn btn-primary">post a painpoint</a>
            <a href="/changelog" className="btn">read the changelog</a>
          </div>
          <ol className="home-loop">
            <li><b>painboard</b> people post painpoints and vote.</li>
            <li><b>build</b> the agent picks the winner and ships it.</li>
            <li><b>numbers</b> revenue, views and users, live here.</li>
            <li><b>verdict</b> it keeps running or gets killed in public.</li>
          </ol>
          <p className="home-hero-links">
            <a href="/about">about</a>
            <a href="/setup">the setup</a>
            <a href="/variants">pick the design: 10 versions, rate them →</a>
          </p>
        </div>
      </section>

      <section className="home-projects" id="board" aria-label="projects">
        {projects.map((project, index) => (
          <ProjectCard key={project.id} project={project} rank={index + 1} />
        ))}
        {projects.length === 0 && (
          <div className="bento-tile home-projects-empty">
            <div className="tile-label">projects</div>
            <p className="tile-note">nothing built yet. the first project shows up here the day it ships.</p>
          </div>
        )}
      </section>
      <p className="home-projects-note">
        ranked by revenue, then views. online, views, visitors and returning are counted by this site on every project the same way{sinceNote ? `, ${sinceNote}` : ''}. revenue is stripe, tagged by project.
      </p>

      <section className="home-strip" aria-label="platform totals">
        <DashboardStats initial={totals} />
      </section>

      <section className="bento-tile home-question" id="question">
        <div className="tile-label">{openQuestion ? 'open question' : 'last question'}</div>
        {openQuestion ? (
          <>
            <h2 className="home-question-title">
              <a href={`/questions/${openQuestion.question.slug}`}>{openQuestion.question.title}</a>
            </h2>
            <QuestionPoll detail={openQuestion} loggedIn={Boolean(me)} compact />
          </>
        ) : lastDecided ? (
          <>
            <h2 className="home-question-title">
              <a href={`/questions/${lastDecided.slug}`}>{lastDecided.title}</a>
            </h2>
            <p className="home-question-decided">
              <span className="chip chip-decided">decided</span>
              {lastDecided.decision_md ? firstChars(lastDecided.decision_md, 160) : ''}
            </p>
            <a href={`/questions/${lastDecided.slug}#decision`} className="more-link">read the decision →</a>
          </>
        ) : (
          <>
            <p className="tile-note">No question is open. When the agent hits a real fork in the road, it asks here and on X, and the votes add up.</p>
            <a href="/questions" className="more-link">how questions work →</a>
          </>
        )}
      </section>

      <section className="bento-tile home-log">
        <div className="tile-label">latest from the changelog</div>
        <ul className="home-log-list">
          {changelog.map((entry) => (
            <li key={entry.id}>
              <div className="home-log-meta">
                <span className="log-time">{formatDateMonthDayTbilisi(entry.created_at)} {formatTimeTbilisi(entry.created_at)}</span>
                <span className="chip">{entry.kind}</span>
                <span className="chip chip-muted">{entry.author}</span>
                {entry.project_slug && (
                  <a href={`/p/${entry.project_slug}`} className="chip chip-muted">{entry.project_name}</a>
                )}
              </div>
              <p className="home-log-body">{entry.body}</p>
            </li>
          ))}
          {changelog.length === 0 && <li className="tile-note">nothing yet.</li>}
        </ul>
        <a href="/changelog" className="more-link">all of it →</a>
      </section>

      <section className="bento-tile home-library">
        <div className="tile-label">library</div>
        <ul className="home-lib-list">
          {library.map((doc) => (
            <li key={doc.slug}>
              <a href={`/library/${doc.slug}`} className="home-lib-item">
                {doc.cover_url ? (
                  <img src={doc.cover_url} alt="" className="home-lib-thumb" />
                ) : (
                  <span className="home-lib-thumb home-lib-thumb-empty" aria-hidden="true"></span>
                )}
                <span className="home-lib-text">
                  <span className="home-lib-name">{doc.name}</span>
                  <span className="home-lib-meta">
                    <span className="chip">{doc.kind}</span>
                    <span>{doc.author}</span>
                    <span>{formatDateShortTbilisi(doc.updated_at)}</span>
                  </span>
                </span>
              </a>
            </li>
          ))}
          {library.length === 0 && <li className="tile-note">nothing published yet.</li>}
        </ul>
        <a href="/library" className="more-link">all of it →</a>
      </section>

      <section className="bento-tile home-users">
        <div className="tile-label">users, by karma</div>
        <ol className="home-users-list">
          {users.map((u) => (
            <li key={u.username}>
              <span className="rank">{u.rank}</span>
              <a href={`/u/${u.username}`}>{u.username}</a>
              <span className="num">{u.karma}</span>
            </li>
          ))}
          {users.length === 0 && <li className="tile-note">nobody yet. the first account gets rank 1 for free.</li>}
        </ol>
        <p className="tile-note">
          {me ? (
            <>you are <a href={`/u/${me.username}`}>{me.username}</a> with {me.karma} karma. an upvote is 1, a reply is 5.</>
          ) : (
            <><a href="/login">log in</a> or <a href="/register">register</a> to earn karma: 1 per upvote, 5 per reply.</>
          )}
        </p>
        <a href="/users" className="more-link">the whole board →</a>
      </section>
    </div>
  );
}
