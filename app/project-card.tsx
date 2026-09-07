import { formatCents } from '@/lib/format';
import { formatDateMonthDayTbilisi } from '@/lib/date-utils';
import { ProjectCard as ProjectCardData } from '@/lib/projects';
import { ProjectLink } from './project-link';

function n(value: number): string {
  return value.toLocaleString('en-US');
}

function statusLine(p: ProjectCardData): string {
  if (p.status === 'live' && p.launched_at) return `live since ${formatDateMonthDayTbilisi(p.launched_at).toLowerCase()}`;
  if (p.status === 'building') return 'not launched yet';
  if ((p.status === 'killed' || p.status === 'dead') && p.launched_at) return `launched ${formatDateMonthDayTbilisi(p.launched_at).toLowerCase()}`;
  return '';
}

/** one project as a commercial: screenshot, name, tagline, status, four live numbers, two money numbers.
    the whole card opens the project; "details" and "log" are the small links at the foot.
    the live numbers carry data attributes so live-client.tsx can update them from /api/live. */
export function ProjectCard({ project, rank }: { project: ProjectCardData; rank: number }) {
  const p = project;
  const pill = p.status === 'dead' ? 'killed' : p.status;
  const title = p.url ? (
    <ProjectLink href={p.url} slug={p.slug} className="project-card-main">{p.name}</ProjectLink>
  ) : (
    <a href={`/p/${p.slug}`} className="project-card-main">{p.name}</a>
  );

  return (
    <article className={`project-card is-${pill}`} data-project-card={p.slug}>
      <div className="project-card-shot">
        {p.screenshot_url ? (
          <img src={p.screenshot_url} alt={`${p.name} screenshot`} width={1280} height={720} loading={rank > 2 ? 'lazy' : 'eager'} />
        ) : (
          <div className="project-card-shot-empty" aria-hidden="true">
            <span>{p.name}</span>
          </div>
        )}
        <span className="project-card-rank">#{rank}</span>
      </div>

      <div className="project-card-body">
        <div className="project-card-head">
          <h2 className="project-card-name">{title}</h2>
          <span className={`status ${pill}`}>{pill}</span>
        </div>
        <p className="project-card-tagline">{p.tagline || 'no tagline yet.'}</p>
        <p className="project-card-status">{statusLine(p)}</p>

        <dl className="project-card-live">
          <div>
            <dt><span className="live-dot pulsing" aria-hidden="true"></span>online now</dt>
            <dd data-project-metric="online">{n(p.online)}</dd>
          </div>
          <div>
            <dt>views</dt>
            <dd data-project-metric="views_total">{n(p.views_total)}</dd>
          </div>
          <div>
            <dt>visitors</dt>
            <dd data-project-metric="visitors_total">{n(p.visitors_total)}</dd>
          </div>
          <div>
            <dt>returning</dt>
            <dd data-project-metric="returning_total">{n(p.returning_total)}</dd>
          </div>
        </dl>

        <dl className="project-card-money">
          <div>
            <dt>revenue all time</dt>
            <dd className={p.revenue_all_time === 0 ? 'zero' : ''}>{formatCents(p.revenue_all_time)}</dd>
          </div>
          <div>
            <dt>last 30 days</dt>
            <dd className={p.revenue_30d === 0 ? 'zero' : ''}>{formatCents(p.revenue_30d)}</dd>
          </div>
        </dl>

        <div className="project-card-foot">
          <span className="project-card-open">{p.url ? `open ${p.name} →` : `about ${p.name} →`}</span>
          <a href={`/p/${p.slug}`} className="project-card-minor">details</a>
          <a href={p.log_url} className="project-card-minor">log</a>
        </div>
      </div>
    </article>
  );
}
