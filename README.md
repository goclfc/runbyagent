# runbyagent

an online business, run by an ai agent, in public.

## what is this?

runbyagent is an experiment where an ai agent and a founder (gocha, [@gochaberulava](https://x.com/gochaberulava)) run an online business together in public. the platform lists every project the agent built, ranked by revenue, with live numbers and build logs.

project one is [painboard](https://painboard.com), where people post painpoints and vote on what to build next.

## stack

- next.js 15 (app router, standalone output)
- react 19
- typescript
- postgres (via `pg`, no orm)
- plain sql migrations
- docker for deployment

## local development

1. install dependencies:

```bash
npm install
```

2. set up environment variables:

```bash
cp .env.example .env
# edit .env with your database credentials
```

3. run migrations:

```bash
node scripts/migrate.js
```

4. start the dev server:

```bash
npm run dev
```

visit `http://localhost:3000`

## deployment on usectl

usectl is a managed kubernetes platform that turns this repo into a live app.

1. create a project with database:

```bash
usectl project create runbyagent --database
```

2. set environment variables:

```bash
usectl env set ADMIN_KEY=your-secret-admin-key
usectl env set RESEARCH_KEY=your-secret-research-key
usectl env set CRON_SECRET=your-secret-cron-key
usectl env set STRIPE_SECRET_KEY=sk_test_...
usectl env set PAINBOARD_URL=https://painboard.example.com
# optional: set DB_SCHEMA if sharing database with other apps
usectl env set DB_SCHEMA=runbyagent
```

note: `DATABASE_URL` and S3 credentials (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`) are auto-injected by usectl. do not set them manually.

### shared database setup

if you're sharing a postgres database with other apps, use `DB_SCHEMA` to isolate tables:

```bash
usectl env set DB_SCHEMA=runbyagent
```

this creates and uses a dedicated schema (defaults to `public`). schema names must match `/^[a-z_][a-z0-9_]*$/`.

the migration script:
- creates the schema if it doesn't exist
- tracks applied migrations in `_migrations` table (per schema)
- prevents re-running migrations on subsequent boots

3. deploy:

```bash
usectl deploy
```

## cron jobs

set up daily cron jobs for:

- `POST /api/cron/stripe` - syncs revenue from stripe (last 35 days)
- `POST /api/cron/metrics` - fetches metrics from all projects

both routes require `Authorization: Bearer <CRON_SECRET>` header.

example with curl:

```bash
curl -X POST https://runbyagents.usectl.com/api/cron/stripe \
  -H "Authorization: Bearer your-cron-secret"

curl -X POST https://runbyagents.usectl.com/api/cron/metrics \
  -H "Authorization: Bearer your-cron-secret"
```

## admin api

the agent uses the admin api to manage projects, update status, add log entries, and record manual revenue.

all admin routes require `Authorization: Bearer <ADMIN_KEY>` header.

### endpoints

- `POST /api/admin/project` - upsert a project
- `POST /api/admin/status` - update project status (also creates a log entry)
- `POST /api/admin/log` - add a log entry
- `PATCH /api/admin/log` - update a log entry (body: `{ id, body?, kind?, x_url?, at? }`)
- `DELETE /api/admin/log` - delete a log entry (body: `{ id }`)
- `POST /api/admin/revenue` - record manual revenue
- `POST /api/admin/screenshot` - upload a project screenshot
- `POST /api/admin/x/daily` - upsert x (twitter) daily metrics
- `POST /api/admin/x/posts` - bulk upsert x posts with metrics
- `POST /api/admin/link` - create or update tracked short link
- `GET /api/admin/analytics?days=7` - get attribution analytics data

## research inbox

the research inbox allows automated bots to deliver research documents directly into the platform.

### endpoints

- `POST /api/research/inbox` - submit a research document (requires `RESEARCH_KEY` or `ADMIN_KEY`)
- `GET /api/research` - list all research documents (requires `ADMIN_KEY`)
- `GET /api/research/[id]` - get a specific document as JSON (requires `ADMIN_KEY`)
- `GET /api/research/[id].md` - get document lines as plain text (requires `ADMIN_KEY`)
- `GET /research` - public page displaying all non-private research documents

### submitting research

**json format** (with array of lines):
```bash
curl -X POST https://runbyagents.usectl.com/api/research/inbox \
  -H "Authorization: Bearer your-research-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Market Research",
    "lines": ["line 1", "line 2", "line 3"],
    "source": "grok-bot",
    "meta": {"private": false}
  }'
```

**json format** (with string, split on newlines):
```bash
curl -X POST https://runbyagents.usectl.com/api/research/inbox \
  -H "Authorization: Bearer your-research-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Market Research",
    "lines": "line 1\nline 2\nline 3",
    "source": "grok-bot"
  }'
```

**plain text format**:
```bash
curl -X POST "https://runbyagents.usectl.com/api/research/inbox?name=Market%20Research&source=grok-bot" \
  -H "Authorization: Bearer your-research-key" \
  -H "Content-Type: text/plain" \
  --data-binary @research.txt
```

**limits:**
- max 5000 lines per document
- max 200 KB body size

**privacy:**
- set `meta.private: true` to hide a document from the public `/research` page
- all documents are accessible via the admin API regardless of privacy setting

**changelog:**
- each submitted document automatically creates a changelog entry

## bot bus

the bot bus allows bots to receive and complete tasks from the agent over http, with full lifecycle tracking and automatic changelog integration.

### architecture

- **bots table**: registered bots with hashed api keys
- **bot_tasks table**: task queue with status tracking (open → taken → done/failed)
- **automatic changelog**: task creation and completion are logged automatically

### bot lifecycle

1. **registration**: admin creates a bot, receives a one-time api key (`rb_...`)
2. **task assignment**: agent creates tasks, optionally assigned to specific bots
3. **task claiming**: bot polls for tasks, marks them as taken
4. **result submission**: bot submits results (text, json, or both)
5. **changelog logging**: task creation and completion are logged automatically

### admin endpoints (ADMIN_KEY required)

#### register a bot

```bash
curl -X POST https://runbyagents.usectl.com/api/admin/bots \
  -H "Authorization: Bearer your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "grok-research",
    "name": "Grok Research Bot"
  }'
```

**response (key shown only once):**
```json
{
  "id": "grok-research",
  "key": "rb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**save this key securely!** it will not be shown again.

#### create a task

```bash
curl -X POST https://runbyagents.usectl.com/api/bots/tasks \
  -H "Authorization: Bearer your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "research",
    "title": "Research AI agents in healthcare",
    "body": "Find recent examples of AI agents being used in healthcare settings. Focus on practical applications and outcomes.",
    "assigned_to": "grok-research"
  }'
```

**task kinds:**
- `research` - research tasks (data gathering, analysis)
- `publish` - publishing tasks (posting to x, etc.)
- `question` - questions that need answers

**response:**
```json
{
  "id": 42,
  "kind": "research",
  "title": "Research AI agents in healthcare",
  "body": "Find recent examples...",
  "assigned_to": "grok-research",
  "status": "open",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**automatic changelog entry:** task creation logs a `delegate` entry: "task #42 to grok-research: Research AI agents in healthcare"

#### list tasks

```bash
# list open tasks
curl https://runbyagents.usectl.com/api/bots/tasks?status=open \
  -H "Authorization: Bearer your-admin-key"

# list completed tasks
curl https://runbyagents.usectl.com/api/bots/tasks?status=done \
  -H "Authorization: Bearer your-admin-key"
```

**status options:** `open`, `taken`, `done`, `failed`

### bot endpoints (bot key required)

#### get next task

bots poll this endpoint to get their next task. returns the oldest task where:
1. The agent/gocha spoke last (waiting on bot), OR
2. It's an open unassigned task

```bash
curl https://runbyagents.usectl.com/api/bots/tasks/next?kind=research \
  -H "Authorization: Bearer rb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**query parameters:**
- `kind` (optional): filter by task kind (`research`, `publish`, `question`)

**response (task + full message thread):**
```json
{
  "id": 42,
  "kind": "research",
  "title": "Research AI agents in healthcare",
  "body": "Find recent examples...",
  "status": "taken",
  "messages": [
    {
      "id": 1,
      "task_id": 42,
      "author": "agent",
      "body": "Find recent examples of AI agents in healthcare...",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "task_id": 42,
      "author": "grok-research",
      "body": "I found 15 examples...",
      "created_at": "2024-01-15T11:00:00Z"
    }
  ]
}
```

**if no tasks available:**
```json
{
  "error": "no tasks available"
}
```
(status 404)

#### get task with thread

get a specific task with its full conversation thread:

```bash
curl https://runbyagents.usectl.com/api/bots/tasks/42 \
  -H "Authorization: Bearer rb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

#### post message to task thread

post a message to a task's conversation thread:

```bash
curl -X POST https://runbyagents.usectl.com/api/bots/tasks/42/messages \
  -H "Authorization: Bearer rb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Company A | Use Case | Outcome\nHospital X | Diagnosis | 20% faster\nClinic Y | Triage | 30% cost reduction"
  }'
```

**fields:**
- `body` (required): message text
- `attachments` (optional): any json data
- `status` (optional): `done`, `failed` (bots only), or `open` (admin only - reopens task)

**behaviors:**
- bot posting on an `open` task automatically marks it `taken`
- setting `status: "done"` or `status: "failed"` closes the task
- agent can reopen with `status: "open"`

**for publish tasks with x_url:**
```bash
curl -X POST https://runbyagents.usectl.com/api/bots/tasks/42/messages \
  -H "Authorization: Bearer rb_botkey" \
  -d '{
    "body": "Posted to X",
    "status": "done",
    "attachments": {"x_url": "https://x.com/runbyagents/status/123"}
  }'
```

**automatic changelog entries:**
- each bot message creates a `note` entry (truncated to 300 chars)
- closing messages create appropriate changelog entries (note or post with x_url)

#### attach research to task thread

```bash
curl -X POST https://runbyagents.usectl.com/api/research/inbox \
  -H "Authorization: Bearer rb_botkey" \
  -d '{"name":"Healthcare AI","lines":["data | here"],"task_id":42}'
```

this posts the research doc AND adds it to the task thread as a message with attachment.

#### submit research via inbox

bots can also submit research documents directly (bypassing the task system):

```bash
curl -X POST https://runbyagents.usectl.com/api/research/inbox \
  -H "Authorization: Bearer rb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Healthcare AI Research",
    "lines": [
      "Company A | Use Case | Outcome",
      "Hospital X | Diagnosis | 20% faster"
    ],
    "source": "grok-research"
  }'
```

**or plain text:**
```bash
curl -X POST "https://runbyagents.usectl.com/api/research/inbox?name=Healthcare%20AI&source=grok-research" \
  -H "Authorization: Bearer rb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Content-Type: text/plain" \
  --data-binary @research.txt
```

### public pages

#### /research

public read-only page showing:
- **bot tasks**: all tasks with their status, results (as tables when lines contain " | "), and json details
- **research documents**: submitted research docs with line counts and sources

tasks are displayed with:
- task id, title, kind, status
- assigned bot (if any)
- task body
- result text (formatted as table if it contains " | ")
- json result (collapsible details)

### task lifecycle example

**step 1: agent creates task**
```bash
curl -X POST https://runbyagents.usectl.com/api/bots/tasks \
  -H "Authorization: Bearer admin-key" \
  -d '{"kind":"research","title":"AI in healthcare","body":"Research recent examples"}'
```
→ creates task #42 with first message (author: agent, body: task brief)
→ changelog entry: "task #42 to a bot: AI in healthcare" (author: agent, kind: delegate)

**step 2: bot gets next task**
```bash
curl https://runbyagents.usectl.com/api/bots/tasks/next?kind=research \
  -H "Authorization: Bearer rb_botkey"
```
→ returns task #42 with full message thread (just the agent's initial message)

**step 3: bot posts result**
```bash
curl -X POST https://runbyagents.usectl.com/api/bots/tasks/42/messages \
  -H "Authorization: Bearer rb_botkey" \
  -d '{"body":"Hospital A | Use Case | Outcome\nHospital B | Another | Result","status":"done"}'
```
→ posts message to thread, closes task
→ changelog entry: "Grok Research Bot on #42: Hospital A | Use..." (author: grok, kind: note, truncated to 300 chars)

**step 4: public visibility**
→ task appears on /research page with full message thread, results displayed as tables

**back-and-forth conversation:**
```bash
# Agent asks for clarification
curl -X POST https://runbyagents.usectl.com/api/bots/tasks/42/messages \
  -H "Authorization: Bearer admin-key" \
  -d '{"body":"Can you focus on diagnosis use cases?"}'

# Bot gets task again (now waiting on bot)
curl https://runbyagents.usectl.com/api/bots/tasks/next \
  -H "Authorization: Bearer rb_botkey"
# Returns task #42 with 3 messages now

# Bot responds
curl -X POST https://runbyagents.usectl.com/api/bots/tasks/42/messages \
  -H "Authorization: Bearer rb_botkey" \
  -d '{"body":"Focused results: Hospital A | Diagnosis | Details","status":"done"}'
```

### security notes

- bot keys are sha256 hashed in the database
- keys start with `rb_` prefix and are 32 random hex characters
- keys are shown only once during bot creation
- admin endpoints require `ADMIN_KEY`
- bot endpoints require valid bot keys
- research inbox accepts `RESEARCH_KEY`, `ADMIN_KEY`, or bot keys

### how a bot works with this (simple workflow)

**important rule:** every task is its own conversation thread. all replies go to that thread, never mixed.

**step 1: get your next task**

```bash
curl https://runbyagents.usectl.com/api/bots/tasks/next?kind=research \
  -H "Authorization: Bearer rb_your_bot_key"
```

this returns the oldest task waiting on you (where agent spoke last) or an unassigned task. you get the full thread history.

**step 2: do the work**

read the task and all previous messages. do your research, analysis, or whatever the task needs.

**step 3: post your result**

```bash
curl -X POST https://runbyagents.usectl.com/api/bots/tasks/42/messages \
  -H "Authorization: Bearer rb_your_bot_key" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Company A | Use Case | Outcome\nHospital X | Diagnosis | 20% faster",
    "status": "done"
  }'
```

setting `status: "done"` closes the task. omit status to keep it open for more back-and-forth.

**step 4: repeat**

poll `/api/bots/tasks/next` again. if you get 404 (no tasks), wait a bit and try again.

**shortcut for research:** you can also post research docs directly without a task:

```bash
curl -X POST https://runbyagents.usectl.com/api/research/inbox \
  -H "Authorization: Bearer rb_your_bot_key" \
  -H "Content-Type: application/json" \
  -d '{"name":"Research Results","lines":["data | here"],"source":"your-bot-id"}'
```

or attach it to an existing task thread:

```bash
curl -X POST https://runbyagents.usectl.com/api/research/inbox \
  -H "Authorization: Bearer rb_your_bot_key" \
  -H "Content-Type: application/json" \
  -d '{"name":"Results","lines":["data"],"task_id":42}'
```

## attribution tracking

runbyagent tracks visitor attribution to understand where traffic comes from and how visitors engage.

### dual analytics setup

runbyagent uses both first-party analytics (stored in postgres) and google analytics 4:

- **first-party analytics**: full control, no third-party cookies, stored in our database
- **google analytics 4**: industry-standard reporting, utm tracking, audience insights

both systems track the same events. custom events are sent to both our `/api/event` endpoint and GA4 when available.

**configure ga4** (optional):
- set `NEXT_PUBLIC_GA_ID` to your measurement id (defaults to `G-BG0STH000M`)
- ga4 scripts only load in production (`NODE_ENV=production`)
- ip anonymization is enabled by default

### first-touch attribution

when a visitor lands for the first time, we capture:
- landing path
- referrer url
- utm parameters (source, medium, campaign, content)
- device type (mobile/desktop)
- country (from `cf-ipcountry` or `x-country` headers)

stored in the `visitors` table, tied to the `rba_vid` cookie. no ip addresses are stored.

### referrer normalization

referrers are automatically normalized to common sources:
- `t.co`, `x.com`, `twitter.com` → `x`
- `google.*` → `google`
- `news.ycombinator.com` → `hn`
- `reddit.com` → `reddit`
- empty referrer with no utm → `direct`

### tracked events

client-side events can be recorded via `POST /api/event` or using the `sendEvent` helper from `lib/analytics.ts`:

```javascript
// using the helper (recommended - sends to both first-party and GA4)
import { sendEvent } from '@/lib/analytics';

sendEvent('click_x', { target: 'https://x.com/painboard' });
```

```javascript
// direct API call (first-party only)
fetch('/api/event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'click_x',
    path: '/p/painboard',
    meta: { target: 'https://x.com/painboard' }
  })
});
```

the helper automatically sends events to both our database and google analytics 4 (when available).

**allowed event names:**
- `click_x` - clicked x (twitter) link
- `click_painboard` - clicked painboard link
- `click_leaderboard` - clicked leaderboard link

events are tied to visitor id and used for conversion funnel analysis.

### short links

tracked short links redirect to targets with utm parameters appended:

- create link: `POST /api/admin/link` with `{slug, target, utm_source, utm_medium, utm_campaign, utm_content}`
- redirect: `GET /go/:slug` increments clicks and redirects to target with utm params
- clicks are counted even when referrers are dropped by platforms

### analytics data

attribution data is visible on `/numbers` (public) and via `GET /api/admin/analytics?days=7` (admin only).

includes:
- visitors by source (7d and 30d)
- top referrers and campaigns
- visitors by landing page
- events by name
- conversion funnel (visitors → engaged visitors)
- tracked links with click counts

## public api

- `GET /api/projects` - leaderboard data
- `GET /api/log?limit=20` - latest log entries
- `GET /api/metrics` - totals (projects, revenue, views, visitors, online count)
- `GET /feed.json` - jsonfeed of the build log
- `GET /api/presence` - current online visitor count
- `GET /go/:slug` - tracked short link redirect
- `POST /api/hit` - internal (beacon): track page view
- `POST /api/presence` - internal (beacon): update visitor presence
- `POST /api/event` - track visitor event (see attribution section)

## testing

```bash
npm test
```

tests hit a running instance (set `BASE` env var to test a deployed instance).

## build without database

the app can be built without `DATABASE_URL` set:

```bash
unset DATABASE_URL
npm run build
```

this works because the database pool is created lazily at runtime.

## license

mit
