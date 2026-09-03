# task for cursor: build runbyagent

runbyagent is the public home of an experiment: an ai agent and a founder (gocha, x.com/gochaberulava) run an online business in public. the platform lists every project the agent built, ranked by revenue gathered, with live numbers and a build log. project one is painboard (a painpoint board, separate repo `goclfc/ideaboard`, same stack, use it as the style and code reference).

build it as a complete, deployable app in this repo. lowercase copy everywhere, no em dashes (use commas or periods). keep it small and honest, no marketing fluff.

## stack (match painboard)

next.js 15 app router with `output: "standalone"`, react 19, typescript, postgres via `pg` (no orm), plain sql migrations in `migrations/*.sql` applied by `scripts/migrate.js` on boot, dockerfile that runs `node scripts/migrate.js && node server.js` on port 80. the pg pool must be created lazily so `next build` works without `DATABASE_URL`. one css file with tokens, light and dark via `prefers-color-scheme`. no ui libraries.

## pages

- `/` the leaderboard. hero: eyebrow `run by agent`, h1 `an online business, run by an ai agent, in public.`, sub `every project the agent built, ranked by the money it made. every number is live, including the zeros.` then the table: rank, project, status (building / live / dead), revenue (all time), revenue last 30 days, users or signups if the project reports them, launched date. rows link to `/p/[slug]`. below the table: totals (projects, live, revenue all time, revenue 30d), then "how this works" (3 short paragraphs: painboard is where ideas come from, the agent builds the winner and ships it, gocha approves anything with money or opinions in it) and "the rules" (nothing hidden, agent says when it's the agent, numbers are public).
- `/p/[slug]` a project: name, tagline, status, links (live url, repo, the painboard idea it came from), its numbers (revenue all time / 30d / 7d with a 30 day bar chart, plus any metrics the project reports via its metrics url as a simple key/value grid), and its build log (entries in reverse order).
- `/log` the build log across all projects: what shipped, what died, what the numbers did. each entry: date, project chip, text (markdown-lite: paragraphs and links only), optional link to the x post.
- `/numbers` totals and 30 day charts for revenue and page views, plus json at `/api/metrics`.
- `/about` the explainer: who, why, how the agent works, links to x and painboard.

## data

```sql
projects (id, slug unique, name, tagline, url, repo_url, idea_url, status building|live|dead, metrics_url, stripe_tag, launched_at, killed_at, created_at)
revenue_daily (project_id, day, cents, source stripe|manual, primary key (project_id, day, source))
project_metrics (project_id, key, value numeric, fetched_at)   -- latest values pulled from metrics_url
log_entries (id, project_id nullable, body, x_url, kind ship|kill|numbers|note, created_at)
hits (day, path, count)
```

## revenue

single stripe account. every charge is tagged with `metadata.project = <slug>` (painboard's checkout and every future project will set it). a cron route `POST /api/cron/stripe` (bearer `CRON_SECRET`) pulls succeeded charges and refunds from the last 35 days via the stripe api (`STRIPE_SECRET_KEY`), groups by `metadata.project` and day, and upserts `revenue_daily` (net of refunds). if the key is missing, the route returns `{ skipped: "no stripe key" }` and the ui shows $0 with a small "stripe not connected yet" note. manual revenue can be added through the admin api for projects paid outside stripe.

## metrics pull

`POST /api/cron/metrics` fetches each project's `metrics_url` (json, flat object of numbers, painboard exposes `/api/metrics`), stores every numeric key in `project_metrics`, and records page views for the project if it reports `views_total`.

## admin api (bearer `ADMIN_KEY`, used by the agent)

```
POST /api/admin/project   { slug, name, tagline?, url?, repo_url?, idea_url?, status?, metrics_url?, stripe_tag?, launched_at? }   upsert
POST /api/admin/status    { slug, status, note? }   also writes a log entry of kind ship or kill
POST /api/admin/log       { project?, body, kind?, x_url? }
POST /api/admin/revenue   { slug, day, cents }   manual, source = manual
```

## public api

```
GET /api/projects            leaderboard rows as json
GET /api/log?limit=20        latest log entries
GET /api/metrics             totals
GET /feed.json               jsonfeed of the build log (for the x posting routine)
```

## seed

migration `002_seed.sql` inserts painboard: slug `painboard`, name `painboard`, tagline `post a painpoint. vote. we build the winners.`, status `live`, url and metrics_url from env `PAINBOARD_URL` if you can, otherwise leave them null and document that the agent sets them through the admin api. also insert one log entry: `runbyagent is live. project one is painboard.` kind note.

## quality bar

- `npm run build` passes with no `DATABASE_URL` set.
- a `tests/api.test.mjs` (node --test, hits a running instance via `BASE`) covers: upsert project, add log entry, manual revenue, leaderboard order by revenue, metrics json.
- pages are responsive (no horizontal scroll at 390px), light and dark both readable.
- `.env.example` documents `DATABASE_URL`, `ADMIN_KEY`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `PAINBOARD_URL`.
- readme: what it is, how to run, how to deploy on usectl (project with `--database`, set env, deploy), the cron routes to call daily.

when done, open a pr titled `runbyagent v0` with a short summary of what was built and anything you could not do.

## infrastructure notes (usectl)

the app deploys on usectl: a managed kubernetes platform that turns this github repo into a live https app. it auto-injects `DATABASE_URL` (postgres) and, when storage is enabled, s3 credentials as `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (minio, s3-compatible). use the dockerfile approach described above, listen on port 80. use s3 for project screenshots: the admin api accepts `screenshot_url` on a project, and add `POST /api/admin/screenshot { slug, image_base64 }` that uploads a png to the bucket with the aws sdk v3 s3 client (endpoint from `S3_ENDPOINT`, forcePathStyle true) and stores the public url on the project; the leaderboard and project page show the screenshot when present. never overwrite the `DATABASE_URL` or `S3_*` env vars.

commit the brief as CURSOR_TASK.md in the repo root, and commit early and often on the branch.
