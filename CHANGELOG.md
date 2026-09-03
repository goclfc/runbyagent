# changelog

everything that happened, from the first prompt on. newest at the bottom. times are tbilisi (utc+4). "gocha" is the founder, "claude" is the agent running the project, "cursor" and "grok bot" are the agents claude delegates to.

## 2026-09-03

- 13:30 gocha opens a session with claude: "i want to start a live project, let you manage my online presence on x. you can use my apps on my mac in background, you can use grok bots, we have stripe, use usectl to host anything, and do online business." the plan forms in conversation: find painpoints, build solutions, put them on a website, track metrics, post everything on x.
- 13:40 decision: gocha keeps posting on his own x account and says openly that it is done with ai. nothing hidden.
- 13:45 decision: claude may write code, host on usectl, merge and test on its own; grok bots as fallback for coding.
- 13:55 the plan: first post what we are doing, then build the platform and post that it is live, then add the first project: an idea board where people post painpoints, upvote, comment and enrich ideas (enrichments get voted too), a grok bot brings one fresh idea a day, bots group ideas, duplicates are caught at submit time, and every idea shows how it evolved.
- 14:05 first post goes out on x from gocha's account, typed and posted by claude through chrome: "starting a live experiment. i'm handing my x account and a cloud machine to an ai agent and we're going to build an online business in public." https://x.com/gochaberulava/status/2095452528917807186
- 14:05 claude starts building the board in its cloud workspace (next.js 15, postgres with pg_trgm, plain sql migrations, no orm). placeholder name: ideaboard.
- 14:15 claude asks a subagent to build ten landing page variants with identical copy: terminal, swiss, brutalist neon, newspaper, machine room, sticky notes, blueprint, win95, quiet, dashboard. brief written first, the same copy for all ten, lowercase, no em dashes.
- 14:30 the board's api and pages are written: submit with live duplicate check ("this idea already exists, upvote that one instead", trigram similarity, claude-judged when an anthropic key is set), votes, enrichments with their own votes, comments, a timeline per idea, nightly grouping job, daily idea job, bot api with bearer keys, admin api for merge and status, metrics with page views.
- 14:35 end to end api test written and run against a local postgres. first run finds a wrong test expectation about vote carry-over on merge (a voter who already voted on the target is not double counted), fixed in the test, code was right.
- 14:38 screenshots of every page at desktop and mobile, light and dark. fixes: vote button stretched to full height on the idea page, author names showed "anon" because the name was set after the actor was resolved, the home stats wrapped 3+1 instead of 4, empty groups showed in the filter.
- 14:41 first commit: "ideaboard: idea board platform with dedup, enrichments, timeline, bots, metrics, and ten landing variants". 57 files.
- 14:45 variant 03 (brutalist neon) scrolled horizontally at 390px, the sticky nav was 547px wide. fixed by the subagent that built it.
- 14:50 the variants gallery thumbnails were unscaled full pages; fixed with a client component that scales each iframe to its card width.
- 14:50 gocha, by hand, pushes the ideaboard code to a private github repo goclfc/ideaboard and starts deploying it on usectl with cursor's cli agent. the docker build fails: the db module created the postgres pool at import time and next.js imports every route during "collecting page data", where there is no DATABASE_URL. cursor makes the pool lazy and pushes the fix.
- 14:55 name chosen: painboard. "it says exactly what it is, one word, lowercase, blunt like the posts."
- 14:57 gocha clarifies the structure: painboard is one project. the thing we are building is a platform that lists every built project, ranked by revenue gathered; painboard is the first project on it. claude renames the repo to painboard and moves the project listing out of it (its /projects now redirects to the platform).
- 15:03 claude applies the same lazy pool fix in the painboard repo so the renamed version does not repeat the build failure. verified: next build passes with no DATABASE_URL.
- 15:05 platform name chosen: runbyagent. "the one that survives every context: the domain, the x bio, the pinned post, the leaderboard header."
- 15:08 gocha sets the operating model: claude is the manager and must delegate, not do everything itself. cursor (max plan) writes code, grok bot (max plan) posts on x and brings insights, claude keeps the business context alive and manages the apps on the mac in the background, with routines for these handoffs.
- 15:10 claude gets background access to cursor and chrome on gocha's mac. finding: an ide can only be clicked, not typed into, so cursor is driven through its cloud agents api instead.
- 15:12 the build brief for runbyagent is written: leaderboard ranked by revenue, project pages, build log, numbers, about, stripe pull tagged by project, metrics pull from each project's /api/metrics, admin api for the agent, json feed for the posting routine, seed with painboard.
- 15:15 gocha provides a cursor api key, the empty repo goclfc/runbyagent and a github token scoped to it.
- 15:17 the cloud sandbox's git proxy refuses to push to repos not added to the session's sources, and cursor refuses an empty repo. gocha commits a readme by hand.
- 15:20 grok bot turns out to be a desktop app; claude gets full background control of it and sends weebo (the bot coordinator) the first task: research 20 real painpoints from x in the last 7 days, ranked, research only, nothing posted. weebo hands it to mario.
- 15:24 the cursor cloud agent is launched on goclfc/runbyagent with the brief plus usectl specifics (injected DATABASE_URL and S3_* env, dockerfile on port 80, migrations on boot, s3 screenshots for projects). branch runbyagent-v0, auto pr.
- 15:30 gocha asks for this changelog: from the first prompt, every little thing, posted on runbyagent. this file is the source; the platform renders it at /changelog.
