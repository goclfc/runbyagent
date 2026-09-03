# runbyagent landing: direction memo

date: 2026-09-03. author: claude (manager). purpose: redesign the landing and ship ten variants people can rate and comment on, so the audience picks the look and, in doing so, learns what runbyagent is.

## what the research says

- **explain in one screen.** the strongest landing pages (arounda's 2026 roundup, netflix / slack / notion patterns) win with one headline, one sentence, one action. ours: "an online business, run by an ai agent, in public." then the live board. no feature grid.
- **bento grids held up, kinetic type and webgl did not** (studiomeyer's six-month review of 2026 trends). dark mode is the default for 82% of phone users. anti-grid brutalism works as counter-positioning. so: at most one heavy variant, the rest fast and readable.
- **open startup pages feel honest when the numbers are bare** (swetrix /open, nomad list, bannerbear /open): precise where known, rounded where not, a live dashboard people can check. our numbers page and leaderboard should read like that, not like marketing.
- **anthropic's project vend** is the narrative reference: an agent ran a business, they published the failures with the wins, self-aware tone, charts over time. our changelog is that story in real time. the landing should point at it.
- **agentmrr** (a revenue leaderboard for ai agents) shows what a credible board looks like: rank, name and one-line description, founder attribution, trend badge, mrr and all-time. we borrow dual metrics and a trend badge, and add "built by the agent from painboard idea #n".
- **design arena** ranks ai-made designs with pairwise votes and elo, not stars, because stars drift. for our variants page: stars and comments as asked, plus a "pick this one" vote, ranked by a bayesian average with a minimum vote count, and an optional "which of these two" duel mode later.
- **kitze's variants page** (the thing that started this): same copy, wildly different art directions, a fixed pill to jump between them. we keep that mechanic and add rating.

## the landing (default design in the app)

dark-first, fast, one column that widens into a bento where it helps. sections in order:

1. hero: eyebrow `run by agent`, h1, one sentence, two buttons (`see the leaderboard`, `post a painpoint`), and a live strip: projects, live, revenue all time, changelog entries (from /api/metrics and /api/log).
2. the loop, as a four-step row: painboard → build → numbers → verdict. one line each.
3. the leaderboard, embedded (the real table).
4. latest from the changelog, five entries, link to all.
5. who does what: gocha (founder, approves money and opinions), claude (agent, manager), cursor (writes code), grok bots (research, drafts, the daily idea).
6. the rules.
7. footer with the variants link: "pick the design: ten versions of this page, rate them."

## the ten variants (same copy, same sections, different worlds)

each variant must explain the project on its own to someone who has never heard of it. the art direction is the explanation.

| # | name | world | what it explains best |
|---|---|---|---|
| 01 | ledger | open books: monospace ledger tables, green ink, every fact a line item | numbers are public |
| 02 | control room | dark mission control, live feed ticking, status leds | an agent is operating right now |
| 03 | lab notebook | research write-up like project vend: serif, figures with captions, failures included | it's an experiment |
| 04 | bento | dark bento grid, every tile one concept | the whole thing at a glance |
| 05 | manifesto | brutalist, huge black type, numbered principles, raw html feel | the rules |
| 06 | receipt | one long thermal receipt of everything that happened, $0 total | the changelog and the zeros |
| 07 | transcript | the story as the agent's own log lines and tool calls | the agent does the work |
| 08 | gazette | daily newspaper front page: headline, board as a stock table, changelog as columns | the day by day public story |
| 09 | comic | light, illustrated four-panel loop, stickers, friendly | the loop, for non-developers |
| 10 | poster | swiss typographic poster, one giant live counter, the sentence | confidence and minimalism |

## copy (verbatim for every variant)

nav: `runbyagent` · `leaderboard` `/` · `changelog` `/changelog` · `variants` `/variants` · `painboard` (placeholder href `#painboard` until it is live) · `x` `https://x.com/gochaberulava`

eyebrow: `run by agent`
h1: `an online business, run by an ai agent, in public.`
sub: `every project the agent builds, ranked by the money it makes. every number is live, including the zeros.`
cta primary: `see the leaderboard` → `/`
cta secondary: `post a painpoint` → `#painboard`

live strip (fetch `/api/metrics` and `/api/log?limit=5` at runtime, fall back to these placeholders): `projects` 1 · `live` 1 · `revenue all time` $0 · `changelog entries` 39

the loop:
1. `painboard` — `people post painpoints and vote. a bot brings one fresh idea a day.`
2. `build` — `the agent picks the winner, writes the code with cursor, and ships it on usectl.`
3. `numbers` — `revenue and users go on the board, live, including the zeros.`
4. `verdict` — `it keeps running, or it gets killed in public. either way it stays on the changelog.`

who does what:
- `gocha` — `founder. approves anything with money or opinions in it.`
- `claude` — `the agent. plans, delegates, reviews, posts, keeps the changelog.`
- `cursor` — `writes the code, opens the pull requests.`
- `grok bots` — `research on x, drafts, the daily painpoint.`

the rules:
- `nothing is hidden. when it's the agent posting, it says so.`
- `every number is public, including the failures.`
- `gocha approves money and opinions. build logs and numbers go out on their own.`

latest from the changelog: five entries, `time · kind · text`, link `all of it →` `/changelog`.

footer: `built in public by gocha and an ai agent. hosted on usectl. this is design NN of 10, rate it at /variants.`

fixed pill bottom right: `variant NN of 10 · rate it` → `/variants#NN`

## requirements per file

- one self-contained html file at `public/variants/NN.html`, inline css and js, google fonts allowed, no libraries.
- `<title>runbyagent · NN name</title>`.
- fetch live numbers from `/api/metrics` (`{projects_total, projects_live, revenue_all_time, revenue_30d}`, cents for revenue) and `/api/log?limit=5` (`[{created_at, kind, body}]`), same origin, with graceful fallback to the placeholders when fetch fails (the file must also look right opened from disk).
- responsive, no horizontal scroll at 390px, light and dark both readable where the direction allows.
- lowercase everywhere, no em dashes. no copyrighted characters or logos.
- animations light; no webgl.
