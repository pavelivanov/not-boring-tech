# Plan 005: Publish reliable weekly Telegram digests in English and Russian

> **Executor instructions**: Implement this feature on its own branch and ship it
> through its own pull request. Follow the plan in order, run every verification
> command, and confirm the expected result before continuing. Stop on any STOP
> condition instead of improvising. When complete, update Plan 005's row in
> `plans/README.md`.
>
> **Drift check (run first)**: this plan was prepared at commit `b8bd1d4` on
> 2026-08-18. Run:
>
> ```sh
> git status --short --branch
> git rev-parse --short HEAD
> git diff --stat b8bd1d4 -- apps/service packages/db scripts railway*.json compose.yaml .env.example README.md business-plan.md plans
> ```
>
> The planning worktree already contained unrelated, uncommitted web changes at
> preparation time. Do not discard, stage, reformat, or include them. Create a
> clean worktree or branch from the intended base before implementation. If any
> in-scope database, analyzer, GitHub-enrichment, deployment, or plan file has
> changed since `b8bd1d4`, compare it with the excerpts in "Current state" and
> stop for plan revision when the described boundary no longer matches.

## Status

- **Priority**: P1
- **Effort**: L (approximately five to eight focused engineering days, plus
  production setup and one controlled live run)
- **Risk**: HIGH (additive database migration, extraction-contract change, and
  irreversible external channel posts)
- **Depends on**: Plan 004 (`DONE`)
- **Category**: direction / feature / infrastructure
- **Planned at**: commit `b8bd1d4`, 2026-08-18
- **Branch**: `codex/weekly-telegram-digests`
- **Pull request**: one PR for this feature only; suggested title
  `feat(service): publish RU and EN weekly Telegram digests`

## Outcome

Once a week, a private one-shot `digest` service publishes eligible catalog
items that have not appeared in any earlier digest—normally items created since
the previous successful cutoff, plus any eligible item whose visibility was
delayed—to two owner-managed Telegram broadcast channels:

1. one English target;
2. one Russian target.

Every delivered Telegram message, including every part of a split digest,
contains a link to the public FindThatProject website. Every catalog item shows:

- its name;
- a description in the target channel's language;
- its canonical project link, or its FindThatProject detail page when no
  grounded canonical URL exists;
- a GitHub repository link when one is known and is different from the main
  link;
- its GitHub star count when a stored count exists, including zero.

The service is resumable. A successful English delivery is not repeated merely
because the Russian target failed. A missed scheduled execution rolls all
undelivered catalog additions into the next successful run. The implementation
never stores or logs raw Telegram source text, the Telegram bot token, or raw
OpenAI responses.

## Audited findings that define the work

| #   | Finding                                               | Category                  | Impact                                                                                                                                                                                                                       | Effort | Fix risk | Evidence                                                                                                                                                                 |
| --- | ----------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Add a separate grounded GitHub URL                    | Correctness / data model  | The current star refresher only recognizes `canonicalUrl` as GitHub, so an item with a product website plus a different repository cannot meet the requested output contract.                                                | M      | MED      | `apps/service/src/analyzer/analysis-schema.ts:16-27`, `packages/db/prisma/schema.prisma:68-75`, `apps/service/src/github/refresh-stars.ts:114-151`                       |
| 2   | Produce durable Russian descriptions                  | Correctness / content     | The catalog stores only `descriptionEn`; a Russian digest cannot be generated without an untracked translation step or a schema change.                                                                                      | M      | MED      | `apps/service/src/analyzer/types.ts:21-30`, `packages/db/prisma/schema.prisma:69-70`, `apps/service/src/catalog/projector.ts:155-175`                                    |
| 3   | Add a dedicated outbound delivery process             | Architecture / security   | The only Telegram integration is a read-side GramJS user session, and the only cron command is the twice-daily parser. Reusing that session for writes would expand its privileges and couple unrelated failure domains.     | M      | MED      | `apps/service/src/sync.ts:12-56`, `apps/service/src/telegram/gramjs-client.ts`, `railway.parser.json:1-11`, `apps/service/tsup.config.ts:3-9`                            |
| 4   | Persist digest windows and per-message delivery state | Reliability               | A plain weekly query plus `sendMessage` can duplicate one language or lose items after retries, partial failure, process crashes, or missed schedules.                                                                       | M      | HIGH     | `packages/db/prisma/schema.prisma:153-173` has ingestion-run state but no outbound ledger; `apps/service/src/sync.ts:14-21` shows the existing advisory-lock convention. |
| 5   | Reconcile the product decision record                 | Documentation / direction | The approved business plan says the website is the only surface and explicitly excludes a Telegram bot. The owner's new request supersedes this only for outbound owner-managed digests, not for an interactive product bot. | S      | LOW      | `business-plan.md:13-15`, `business-plan.md:118-124`, `business-plan.md:197-200`                                                                                         |

All five findings are HIGH confidence: the cited code was read directly. No
unrelated correctness, security, performance, or UI findings belong in this PR.

## Product and data definitions

These definitions are requirements, not suggestions for the executor to
reinterpret.

### What counts as a new item

Use `CatalogItem.createdAt`, not `firstMentionedAt` and not the source Telegram
publication date. Also track whether an item has ever been reserved in a digest
snapshot; a visible item that was ineligible during an earlier run must not be
lost forever merely because the cutoff advanced.

- `windowStart` is the `windowEnd` of the latest successful digest.
- `windowEnd` is captured once when a new digest run is prepared.
- `eligibilityStartAt` is fixed from `DIGEST_INITIAL_START_AT` on the first run
  and copied forward unchanged on every later run.
- Select visible catalog rows satisfying
  `createdAt > eligibilityStartAt AND createdAt <= windowEnd` and having no
  `WeeklyDigestItem` snapshot in any existing run.
- Order snapshots by `createdAt ASC, id ASC` before assigning an ordinal.
- A late-ingested or backfilled old post is therefore announced when it first
  creates a catalog item. It is not silently lost because its source date is old.
- A new mention that resolves to an already-existing catalog item is not a new
  item and is not announced again.
- An item created after `eligibilityStartAt` but hidden when an earlier digest
  was prepared remains unannounced. If it later becomes visible, a later run
  carries it forward and announces it once even though `createdAt <= windowStart`.
- Freeze selected fields in digest-item snapshots. Later catalog edits must not
  change the text of a retrying run.

The first production run has no prior successful cutoff. It must use the
required `DIGEST_INITIAL_START_AT` ISO-8601 UTC value. Set that value to the last
completed parser run before digest activation, normally no more than seven days
before the controlled first run. Refuse an initial lookback over 14 days to
prevent an accidental historical-corpus broadcast.

After any successful run, do not create another run until at least 144 hours
have elapsed since its cutoff. An early manual or duplicate scheduler invocation
must exit successfully as a no-op. An existing nonterminal run is always resumed
regardless of age.

### Link semantics

- `canonicalUrl` remains the main project link and identity input.
- Add a separate grounded `githubUrl` to the extraction candidate and catalog
  projection. It must be an exact HTTP(S) link present in the source post and
  must resolve syntactically to a GitHub repository, never a profile, topic, or
  invented URL.
- Normalize stored catalog GitHub links to
  `https://github.com/<owner>/<repository>`.
- The GitHub refresher must inspect `githubUrl` first and fall back to
  `canonicalUrl` for repository-only items.
- In the digest, render the GitHub line only when the normalized GitHub URL is
  different from the normalized main link. A star count is conditional on
  `githubStars !== null`, not on truthiness, so `0` is displayed.
- If `canonicalUrl` is null, the required item link is
  `<DIGEST_SITE_ORIGIN>/tools/<slug>`. Do not invent an external URL.
- Every message part also contains a clearly labelled link to
  `DIGEST_SITE_ORIGIN` itself.

### Language semantics

Extend the existing structured extraction result with a required
`descriptionRu` alongside `descriptionEn`. Generate both in the same existing
OpenAI Structured Outputs request while source text and grounded links are
already available. Do not make a second translation request in the digest job.

Database columns are nullable only to make the additive migration safe for
existing production rows. Every newly analyzed presentation must have both
bounded descriptions. A selected new item without `descriptionRu` is a data
integrity failure: prepare no delivery for that run, mark it `REVIEW_REQUIRED`,
and report only a safe error class. Never silently send English text to the
Russian channel.

### Empty weeks

Publish one localized "no new items this week" message to each target and
include the FindThatProject website link. This advances the cutoff and proves
the weekly job is healthy. It must still obey the same delivery ledger and
partial-resume behavior.

## Architecture

```text
configured source channels
          │
          ▼
parser (twice daily) ──▶ PostgreSQL catalog + RU/EN metadata + GitHub stars
                                   │
                                   │ createdAt eligibility + visible + unsent
                                   ▼
digest (weekly) ──▶ durable snapshots/outbox ──▶ Telegram Bot API
                                                     ├── EN owner channel
                                                     └── RU owner channel

Every Telegram message ──▶ DIGEST_SITE_ORIGIN
Every item name/detail ──▶ /tools/<slug>
```

The `digest` service is a fifth service in the existing Railway project and
production environment. It uses the same `apps/service/Dockerfile` as `api` and
`parser`, but runs `node apps/service/dist/digest.js publish`, has no public
domain, never restarts a completed run, and has a weekly UTC cron.

### Dedicated Bot API boundary

Use a dedicated Telegram bot added as an administrator to exactly the two
output channels with `can_post_messages`. Do not publish through the GramJS user
session used for ingestion. Do not add the output channel handles to
`TELEGRAM_CHANNELS`; doing so creates a content feedback loop.

Use Node's built-in `fetch` against the official Bot API rather than adding a
wrapper dependency. Current Telegram Bot API documentation confirms that
`sendMessage` accepts channel `chat_id`, formatted text, and link-preview
options, and returns a sent `Message` on success. The bot requires channel
administrator rights including `can_post_messages`. Re-resolve the official
Telegram Bot API documentation through Context7 immediately before
implementation in case the request or permission contract has changed.

### Message layout and splitting

Use Telegram HTML formatting with a tiny allowlist generated by code. Escape all
catalog names and descriptions. Never interpolate unescaped database content
into HTML or an `href`.

Each localized part has this logical shape:

```text
<localized digest heading> · <window dates> · <part X/Y when split>
<localized full-catalog label>: <DIGEST_SITE_ORIGIN>

1. <name>
<localized description>
<localized main-link label>: <canonical URL or site detail URL>
GitHub: <repository URL> · ★ <stars, only when known>
```

Build each item as an indivisible block and greedily pack blocks in ordinal
order. Keep both the rendered HTML string and its visible text conservatively
below Telegram's documented message maximum: use an internal target of at most
3,500 UTF-16 code units of visible text and at most 3,900 code units of rendered
HTML. Repeat the heading and site link in every part. Disable link previews to
prevent a digest from becoming a wall of preview cards.

Send parts sequentially per target. Do not use paid broadcast options. Honor a
Bot API `retry_after` value for explicit rate-limit responses, cap a wait at 60
seconds, and allow at most three attempts for responses that unambiguously say
the message was not accepted. A network timeout or connection loss after a send
begins is ambiguous and must not be retried automatically.

### Delivery-state and crash semantics

Add a durable outbox with these conceptual records. Exact Prisma names may
match the names below; do not collapse the records into one untyped JSON blob.

```text
WeeklyDigestRun
  id, eligibilityStartAt, windowStart, windowEnd, status, itemCount,
  failureClass?, createdAt, updatedAt

WeeklyDigestItem
  id, digestRunId, catalogItemId?, ordinal, slug, name,
  canonicalUrl?, githubUrl?, githubRepository?, githubStars?,
  descriptionEn, descriptionRu, catalogCreatedAt, createdAt

WeeklyDigestDelivery
  id, digestRunId, language (EN|RU), partIndex,
  targetChatId, renderedHtml, status,
  attemptCount, telegramMessageId?, lastAttemptedAt?, sentAt?,
  failureClass?, resolvedAt?, createdAt, updatedAt
```

Required constraints and relations:

- unique digest `(windowStart, windowEnd)`;
- unique snapshot `(digestRunId, catalogItemId)` and
  `(digestRunId, ordinal)`;
- unique delivery `(digestRunId, language, partIndex)`;
- cascade run deletion to snapshots and deliveries;
- `WeeklyDigestItem.catalogItemId` is nullable with `onDelete: SetNull`, because
  the snapshot must survive later catalog consolidation;
- relation/index support for finding catalog items with no prior digest
  snapshot, so temporarily invisible items can carry into a later run;
- index `CatalogItem(createdAt, id)` for window selection;
- check nonnegative star snapshots when non-null;
- use Prisma enums for run, language, and delivery statuses.

State transitions:

1. Under a dedicated PostgreSQL advisory lock, resume the oldest nonterminal
   run or prepare exactly one new run and all snapshots/deliveries in a single
   database transaction.
2. Before an HTTP send, atomically move one `PENDING` or safely retryable
   `FAILED` delivery to `SENDING` and increment `attemptCount`.
3. On a successful Bot API response, persist `telegramMessageId`, `sentAt`, and
   `SENT` immediately.
4. On an explicit Bot API rejection, store only a bounded safe error class and
   use `FAILED`; do not store or print the response description.
5. On a timeout/network error, or if a prior process left a delivery in
   `SENDING`, move it to `REVIEW_REQUIRED`. Telegram has no application-provided
   idempotency key, so automatic resend could duplicate a public post.
6. A run becomes `SUCCEEDED` only when every EN and RU part is `SENT`. If one
   target is incomplete, keep the run nonterminal and never advance the window.
7. A later invocation sends only unsent deliveries. It never republishes a
   `SENT` row.

Provide a bounded maintenance command in the same entry point for the ambiguous
case:

```text
node apps/service/dist/digest.js resolve \
  --delivery-id <uuid> \
  --outcome sent --message-id <positive-integer>

node apps/service/dist/digest.js resolve \
  --delivery-id <uuid> \
  --outcome unsent
```

Allow this only for `SENDING` or `REVIEW_REQUIRED` deliveries. `sent` records the
owner-confirmed Telegram message ID; `unsent` moves the delivery back to
`PENDING`. Do not offer a bulk reset or delete command.

## Current state and conventions to preserve

- `packages/db/prisma/schema.prisma:59-87` is the stable catalog projection.
  It has `canonicalUrl`, English description, GitHub repository/count cache, and
  stable `createdAt`, but no Russian description, separate repository URL, or
  digest state.
- `apps/service/src/analyzer/analysis-schema.ts:16-28` defines a strict
  Structured Outputs object. `validatePostAnalysis` at lines 123-145 grounds
  `subjectUrl` against the Telegram-supplied link list. Extend that same boundary
  for `githubUrl`; do not weaken it.
- `apps/service/src/analyzer/prompt.ts:3-22` versions the prompt/schema and tells
  the model never to invent URLs. Bump both constants when adding required
  output fields.
- `apps/service/src/collector/collect-channel.ts:272-303` replaces candidate rows
  transactionally and immediately projects the replacements. Persist both new
  fields inside this transaction.
- `apps/service/src/catalog/projector.ts:122-177` deterministically chooses the
  winning display candidate and refreshes aggregate catalog fields. Preserve
  confidence/newness/ID ordering. Select the first non-null grounded GitHub URL
  from that same ordered candidate list rather than coupling it to the display
  winner.
- `apps/service/src/github/refresh-stars.ts:107-151` parses repositories from
  `canonicalUrl`, clears stale cache data, and later uses conditional GitHub API
  requests. Extract URL parsing into a reusable module and prefer `githubUrl`
  without changing retry, ETag, or safe-log behavior.
- `apps/service/src/catalog/queries.ts:147-156` defines visibility as at least one
  presentation saved from an enabled channel. Reuse `visibleCatalogWhere`; do
  not invent a second visibility definition.
- `apps/service/src/sync.ts:12-56` is the one-shot-process exemplar: parse config,
  connect to Prisma, acquire an advisory lock, emit aggregate JSON, release in
  `finally`, and disconnect. Match this lifecycle in `digest.ts`.
- `packages/db/src/advisory-lock.ts:3-60` provides the current sync lock. Refactor
  the implementation behind two named exports—one sync lock and one digest
  lock—without changing the existing sync lock name or behavior.
- `apps/service/src/config.ts:78-143` uses strict Zod schemas, bounded integer
  parsing, normalized configuration, and credential-safe errors. Add a separate
  `parseDigestConfig`; do not make API or parser processes require digest values.
- `apps/service/src/github/refresh-stars.ts:54-60` and its tests demonstrate
  dependency injection for `fetch` and `now`. Use the same pattern for the Bot
  API client and digest coordinator so all offline tests use fakes.
- `apps/service/test/pipeline.integration.test.ts:135-148` demonstrates the
  disposable-database guard and cleanup order. Model the digest database test on
  this pattern and update existing cleanup where new foreign keys require it.
- `apps/service/tsup.config.ts:3-9` currently bundles only `server.ts` and
  `sync.ts`; add `src/digest.ts` as a third entry.
- `railway.parser.json:1-11` is the one-shot Railway service pattern. Add a
  sibling `railway.digest.json`; do not add a domain or health check.
- `scripts/railway-env-push.sh:36-50` and
  `scripts/railway-deploy.sh:49-53` use explicit service/variable allowlists.
  Extend them rather than bypassing them.
- `apps/web/app/routes.ts:3-7` provides stable `/tools/:slug` detail URLs.
  No web code is required for this feature.
- Service code uses TypeScript ESM, semicolons, explicit readonly interfaces,
  Zod at untrusted boundaries, injected clocks/fetch functions, bounded errors,
  Vitest, and Prettier. Match these conventions.

## Commands the executor will need

Run commands from the repository root unless noted.

| Purpose                     | Command                                                                                                                                                                               | Expected on success                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Install                     | `npm ci`                                                                                                                                                                              | exit 0; root lockfile remains the only lockfile                       |
| Generate Prisma client      | `npm run generate --workspace=@findthatproject/db`                                                                                                                                    | exit 0                                                                |
| Feature unit tests          | `npm run test --workspace=@findthatproject/service -- --run digest config analysis-schema github-stars openai-post-analyzer extraction-eval`                                          | selected tests pass; no real Telegram/OpenAI calls                    |
| Full offline gate           | `npm run check`                                                                                                                                                                       | lint, typecheck, all non-credential tests, and builds pass            |
| Start disposable DB         | `POSTGRES_PASSWORD=unused docker compose --profile test up -d db-test`                                                                                                                | `db-test` becomes healthy on loopback port 5433                       |
| Apply migrations to test DB | `DATABASE_URL=postgresql://findthatproject_test:findthatproject_test@127.0.0.1:5433/findthatproject_test npm run migrate:deploy --workspace=@findthatproject/db`                      | all migrations apply once; a second run reports no pending migrations |
| DB integration              | `TEST_DATABASE_URL=postgresql://findthatproject_test:findthatproject_test@127.0.0.1:5433/findthatproject_test npm run test --workspace=@findthatproject/service -- --run integration` | API, catalog, pipeline, and digest integration tests all pass         |
| Build service image         | `docker build -f apps/service/Dockerfile -t findthatproject-service:weekly-digest .`                                                                                                  | image builds with `dist/digest.js` present                            |
| Non-root image              | `docker run --rm --entrypoint id findthatproject-service:weekly-digest`                                                                                                               | output identifies the unprivileged `node` user                        |
| CLI help                    | `docker run --rm findthatproject-service:weekly-digest node apps/service/dist/digest.js --help`                                                                                       | exit 0 without credentials or network calls                           |
| Env validation              | `npm run railway:env -- digest --dry-run`                                                                                                                                             | prints allowlisted key names only; never values                       |
| Deploy help                 | `npm run deploy:railway -- --help`                                                                                                                                                    | help lists `digest` as a one-shot service                             |

The baseline `npm run check` passed at plan time: contracts had 4 tests, service
had 51 passing unit tests with 22 DB tests skipped without `TEST_DATABASE_URL`,
and web had 30 passing tests. The executor must run the disposable-database gate
because the normal offline command does not prove migrations or outbox behavior.

## Environment and secret matrix

Add these digest-only settings:

| Variable                     | Required | Validation and purpose                                                                                                      |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | yes      | existing PostgreSQL URL validation; Railway must use `${{Postgres.DATABASE_URL}}`                                           |
| `TELEGRAM_DIGEST_BOT_TOKEN`  | yes      | non-empty secret; never included in validation errors, request logs, or URLs shown in errors                                |
| `TELEGRAM_DIGEST_CHANNEL_EN` | yes      | `@public_handle` or negative numeric channel ID; must differ from RU target                                                 |
| `TELEGRAM_DIGEST_CHANNEL_RU` | yes      | same format; must differ from EN target                                                                                     |
| `DIGEST_SITE_ORIGIN`         | yes      | HTTPS origin only in production; no path, query, fragment, credentials, or trailing-path configuration                      |
| `DIGEST_INITIAL_START_AT`    | yes      | offset-aware ISO datetime; used only when no successful run exists; runtime rejects future values and lookback over 14 days |
| `DIGEST_REQUEST_TIMEOUT_MS`  | no       | bounded 1,000-30,000; default 15,000                                                                                        |
| `DIGEST_MAX_ATTEMPTS`        | no       | bounded 1-3; default 3, applied only to explicit safe-to-retry Bot API responses                                            |
| `LOG_LEVEL`                  | no       | existing bounded default                                                                                                    |

Only the `digest` Railway service receives the bot token and output-channel IDs.
It does not receive the GramJS session, Telegram API hash, OpenAI key, GitHub
token, or API CORS settings. `parser` keeps its current credentials and does not
receive the bot token.

Update `.env.example`, the optional local Compose `digest` profile,
`.env.railway.digest` documentation, and the Railway environment allowlist. The
real `.env.railway.digest` remains ignored by the existing `.env.*` rule.

## Scope

### In scope

- `packages/db/prisma/schema.prisma`
- one new additive migration under `packages/db/prisma/migrations/`
- `packages/db/src/advisory-lock.ts`
- `packages/db/src/index.ts`
- `apps/service/src/analyzer/analysis-schema.ts`
- `apps/service/src/analyzer/types.ts`
- `apps/service/src/analyzer/prompt.ts`
- `apps/service/src/collector/collect-channel.ts`
- `apps/service/src/catalog/projector.ts`
- `apps/service/src/github/refresh-stars.ts`
- a new focused GitHub repository-URL helper under
  `apps/service/src/github/`
- `apps/service/src/eval/extraction-eval.ts`
- selected synthetic cases in `apps/service/src/eval/extraction-eval-cases.ts`
- new digest modules under `apps/service/src/digest/`
- new `apps/service/src/digest.ts`
- `apps/service/src/config.ts`
- `apps/service/tsup.config.ts`
- `apps/service/package.json`
- affected service unit and database integration tests, plus new digest tests
- `.env.example`
- `compose.yaml`
- new `railway.digest.json`
- `scripts/railway-env-push.sh`
- `scripts/railway-deploy.sh`
- `README.md`
- `business-plan.md`
- `plans/README.md` and this plan's status only

### Out of scope

- all `apps/web/app/**` UI and API-client changes;
- changing the public catalog API contract merely to expose `descriptionRu` or
  `githubUrl`—the digest reads the database internally;
- an interactive Telegram bot, commands, replies, comments, direct messages,
  user subscriptions, or user-selectable channels;
- adding digest output channels to the ingestion source list;
- reanalyzing or translating the existing historical corpus;
- editing/deleting already-sent Telegram posts automatically;
- webhooks or a long-running Bot API polling process;
- a generic notification framework, queue product, or new third-party Telegram
  SDK;
- ranking, recommendations, analytics, tracking links, UTM parameters, or paid
  broadcast features;
- changing catalog identity/deduplication rules;
- changing the existing parser's twice-daily schedule;
- unrelated dirty web files present when this plan was authored.

## Suggested executor toolkit

- Use `find-docs`/Context7 for current official Telegram Bot API and Railway cron
  contracts before implementing external requests or deployment configuration.
- Use `github:yeet` only after offline gates pass and the reviewed diff contains
  no unrelated working-tree changes; open the feature PR as a draft first.
- No frontend skill is needed because web UI changes are explicitly out of scope.

## Git and pull-request workflow

1. Start from a clean current `main` worktree. Preserve the user's existing
   uncommitted web changes in their original worktree.
2. Create `codex/weekly-telegram-digests`.
3. Use the repository's observed imperative/conventional style. Recommended
   commits:
   - `feat(service): extract bilingual descriptions and GitHub links`
   - `feat(service): add durable weekly Telegram digest delivery`
   - `ops(railway): schedule the weekly digest publisher`
   - `docs: document Telegram digest operation`
4. Run all offline and disposable-database gates before pushing.
5. Push the branch and open one draft PR titled
   `feat(service): publish RU and EN weekly Telegram digests`.
6. The PR description must include: data migration shape, selection-window
   definition, Bot API secret/permission boundary, ambiguity behavior, exact
   verification commands, initial-cutoff choice, and rollback steps.
7. Mark ready for review only after the diff is scoped and gates pass. Do not
   merge solely because a deployment built; review the outbound side effects and
   migration first.

## Implementation sequence

### Step 1: Reconfirm external contracts and freeze the feature boundary

Before editing code:

1. Resolve current official Telegram Bot API docs for `sendMessage`, channel
   administrator rights, HTML entities, message length, link-preview options,
   response/error fields, and `retry_after`.
2. Resolve current Railway docs for cron services, config-file paths, one-shot
   completion semantics, and reference variables.
3. Record links and any material deviations in the PR description. If current
   docs invalidate this plan, stop before coding.
4. Confirm the output channels are owner-managed and are not present in
   production `TELEGRAM_CHANNELS`.

**Verify**: `git status --short --branch` shows the clean feature branch and no
source changes yet. Documentation lookup succeeds from authoritative sources.

### Step 2: Extend grounded extraction for Russian text and separate GitHub URLs

Update the strict presentation contract:

- add required `descriptionRu` with the same 1-400 normalized-character bound as
  `descriptionEn`;
- add nullable `githubUrl`;
- ground `githubUrl` against the exact Telegram-supplied HTTP(S) link set, just
  like `subjectUrl`;
- additionally reject a non-null `githubUrl` unless the repository parser
  recognizes an owner/repository path;
- keep `subjectUrl` as the main project URL; direct the model to prefer an
  official product/docs site when both that site and GitHub are present;
- allow `subjectUrl === githubUrl` when GitHub is the only project link;
- require a concise natural Russian description, not transliterated English;
- bump `PROMPT_VERSION` and `SCHEMA_VERSION`;
- persist both fields in candidate replacement.

Extract the repository URL parser from `refresh-stars.ts` into a side-effect-free
module. Preserve all current reserved-owner and path validation. Add a canonical
repository URL helper used by validation, projection, enrichment, and digest
comparison.

Extend the extraction evaluation so both URL fields count toward grounding
violations and add `russianDescriptionViolations`, defined at minimum as a
missing/empty/bounds failure or no Cyrillic letter. Add synthetic main-site plus
GitHub cases and GitHub-only cases. Do not include copied real posts.

**Verify**:

```sh
npm run test --workspace=@findthatproject/service -- --run analysis-schema openai-post-analyzer extraction-eval github-stars
```

Expected: all selected tests pass; invented/unlisted/non-repository GitHub URLs
are rejected; the request remains `store: false` with no tools; both descriptions
and both grounded links are present in the valid fixture.

### Step 3: Add the bilingual/GitHub and digest-state migration

Create one additive Prisma migration that:

- adds nullable `descriptionRu` and `githubUrl` to `PresentationCandidate`;
- adds nullable `descriptionRu` and `githubUrl` to `CatalogItem`;
- adds `CatalogItem(createdAt, id)`;
- creates the three typed digest tables/enums and constraints described above;
- does not rewrite existing rows, delete data, or make existing English fields
  nullable;
- does not give existing rows fabricated Russian descriptions or repository
  links.

Update Prisma relations and DB type exports. Update the catalog projector to
copy the winner's Russian description and the first non-null GitHub URL in the
already-deterministic ordered candidate list. Update the GitHub refresher to use
the separate link first, fall back to canonical, and clear cached metadata only
when neither resolves to a repository.

Update every test fixture that creates candidates or catalog rows. Update
database-test cleanup to delete digest deliveries/items/runs before catalog
items when required by foreign keys.

**Verify**:

```sh
npm run generate --workspace=@findthatproject/db
npm run typecheck --workspace=@findthatproject/db
npm run typecheck --workspace=@findthatproject/service
```

Expected: all exit 0 and no generated Prisma source is staged.

Then apply the migration twice to the disposable test database. Expected: first
application succeeds; second reports no pending migration.

### Step 4: Implement deterministic localized rendering

Create a pure renderer under `apps/service/src/digest/` with no database or
network access. Inputs are a run window, ordered snapshots, language, and site
origin. Output is an ordered array of rendered HTML messages with visible-length
metadata.

Requirements:

- fixed EN/RU labels and UTC date formatting;
- HTML-escape `&`, `<`, `>`, and quotes where relevant;
- validate every URL before placing it in `href`;
- no full raw URL as anchor text—use bounded labels/repository name;
- always include the site-root link in every part;
- include a site detail link for every item;
- main link fallback and conditional GitHub/stars behavior exactly as defined;
- show zero stars;
- stable ordinal order and deterministic chunk boundaries;
- empty-week messages in both languages;
- enforce both conservative length ceilings before returning;
- throw a safe renderer error instead of truncating a name, description, or item
  block.

**Verify**:

```sh
npm run test --workspace=@findthatproject/service -- --run digest-renderer
```

Expected: tests cover EN, RU, empty week, HTML injection characters, missing
canonical URL, identical/different GitHub URL, null/zero/large stars, maximum
description length, multi-part output, deterministic rerender, and a site link in
every part.

### Step 5: Implement a secret-safe Telegram Bot API client

Create an injected-fetch client with a narrow interface such as:

```ts
interface TelegramDigestPublisher {
  sendMessage(input: {
    readonly chatId: string;
    readonly html: string;
  }): Promise<{ readonly messageId: bigint }>;
}
```

The production implementation must:

- POST JSON to `sendMessage`;
- use `parse_mode: "HTML"` and disabled link previews;
- enforce request timeout and configured attempt bounds;
- parse success/error JSON with Zod before use;
- return only the positive message ID;
- classify authentication, permission/target, payload, rate-limit, server, and
  ambiguous network failures into bounded constant error classes;
- honor an explicit bounded `retry_after` only when safe;
- never include the token, target chat ID, HTML, response description, or full
  request URL in errors/logs;
- never automatically retry ambiguous network failures.

Use mocked `fetch` and injected sleep in tests. No unit test may contact
Telegram.

**Verify**:

```sh
npm run test --workspace=@findthatproject/service -- --run telegram-bot-client
```

Expected: success, 400, 401/403, 429 with bounded delay, 5xx, malformed JSON,
timeout, and connection-loss tests pass; credential sentinels never appear in
rendered errors.

### Step 6: Implement the snapshot/outbox coordinator and maintenance resolver

Create a coordinator with injected database, publisher, clock, and sleep. Reuse
`visibleCatalogWhere`. Keep preparation in one transaction and sending outside
long-lived transactions.

Required behavior:

1. Resume oldest nonterminal run before considering a new window.
2. Treat any inherited `SENDING` delivery as ambiguous and require review.
3. For a new run, validate the initial cutoff rules, immutable
   `eligibilityStartAt`, 144-hour minimum interval, and
   `windowStart < windowEnd`.
4. Query and snapshot all visible, never-snapshotted eligible items. Refuse
   missing RU metadata.
5. Render both languages and persist every delivery before a network call.
6. Send sequentially, persisting the state transition before and after each
   request.
7. Recompute run status from deliveries after every outcome.
8. Emit only aggregate result data: run ID, window, item count, part counts,
   sent counts, status, and safe failure class.
9. Implement the single-delivery resolver exactly as described. Recompute run
   status after a manual resolution.

Add `acquireDigestAdvisoryLock` with a different fixed lock name from parser
sync. Add unit tests for no-op interval, first run, missed-week backlog, empty
week, EN success/RU failure, split-part resume, inherited `SENDING`, ambiguous
network outcome, no duplicate `SENT` delivery, manual sent/unsent resolution,
and safe aggregate logs.

Add a disposable-PostgreSQL integration test that proves:

- the first run selects only eligible `createdAt` rows and later runs do not
  repeat snapshotted rows;
- invisible/orphaned items are excluded while invisible, and an eligible item
  is carried into a later run exactly once if it becomes visible;
- snapshots survive catalog field edits and catalog-item deletion/consolidation;
- a partial run blocks creation of a later window;
- successful resume advances the next start cutoff;
- an early repeat is a no-op;
- two concurrent coordinators cannot prepare or send the same run.

**Verify**:

```sh
npm run test --workspace=@findthatproject/service -- --run digest
TEST_DATABASE_URL=postgresql://findthatproject_test:findthatproject_test@127.0.0.1:5433/findthatproject_test npm run test --workspace=@findthatproject/service -- --run digest.integration
```

Expected: all pass with fake publishers; no external requests occur.

### Step 7: Add the one-shot CLI and strict configuration

Add `parseDigestConfig` without changing which variables `server` or `sync`
requires. Validate and normalize the environment matrix above. Credential-safe
error tests must include a bot-token sentinel.

Add `apps/service/src/digest.ts` following `sync.ts`:

- `publish` is the default operational command;
- `resolve` is the bounded manual recovery command;
- `--help` exits 0 before parsing environment;
- acquire/release the digest advisory lock in `finally`;
- disconnect Prisma in `finally`;
- use exit 0 for success/no-op, 2 for partial/retryable incomplete, 3 for review
  required, 75 for lock contention, and 1 for config/fatal failure;
- stdout/stderr contain only safe aggregate JSON or a safe error class.

Add the entry to tsup and service package scripts. Ensure the Docker build copies
it automatically with the rest of `dist`.

**Verify**:

```sh
npm run build --workspace=@findthatproject/service
node apps/service/dist/digest.js --help
```

Expected: exit 0; help lists `publish` and `resolve`; no environment is required
for help.

### Step 8: Add the fifth Railway service and local profile

Create `railway.digest.json` with the existing service Dockerfile, start command
`node apps/service/dist/digest.js publish`, no health check, restart policy
`NEVER`, and a weekly cron of `0 9 * * 1` UTC (Monday 09:00 UTC). This intentionally
runs after the parser's Monday 00:00 UTC execution so newly projected items and
stored stars are available.

Extend:

- Compose with an opt-in `digest` profile and digest-only environment;
- `.env.example` with placeholders, never live values;
- Railway env tooling with `digest` and `all` target support and the exact
  digest allowlist;
- Railway deploy tooling so `digest` is treated like `parser`: one-shot success,
  no public-health probe;
- service/image documentation and production topology from four to five
  services.

Re-resolve Railway docs before finalizing the cron file. Do not assume Railway
uses local time.

**Verify**:

```sh
npm run railway:env -- digest --dry-run
npm run deploy:railway -- --help
docker build -f apps/service/Dockerfile -t findthatproject-service:weekly-digest .
docker run --rm findthatproject-service:weekly-digest node apps/service/dist/digest.js --help
```

Expected: all exit 0, env output contains key names only, and `digest` is listed
as a one-shot service.

### Step 9: Reconcile product and operations documentation

Update `business-plan.md` narrowly:

- the public website remains the primary searchable product surface;
- two owner-managed outbound digest channels are an explicit convenience
  surface;
- interactive bots, user subscriptions, private-content ingestion, and
  user-configured channels remain out of scope;
- normalized catalog metadata is English plus the Russian digest description;
- no visitor analytics are added.

Update `README.md` with:

- five-service Railway topology and digest data flow;
- weekly schedule in UTC;
- bot creation/permission steps without any token value;
- strict secret placement;
- initial cutoff choice and 14-day guard;
- output-channel feedback-loop warning;
- status/exit codes and ambiguous-delivery resolution workflow;
- local fake/unit and disposable-DB verification;
- production rollback instructions.

Update `plans/README.md` status only as execution progresses. Do not mark the plan
`DONE` before live acceptance.

**Verify**:

```sh
rg -n "digest|DIGEST_|TELEGRAM_DIGEST|five" README.md business-plan.md .env.example plans/README.md
```

Expected: the new boundary, variables, schedule, and operation are documented;
no credential value appears.

### Step 10: Run offline, database, image, and extraction gates

Run the command table in full. Then run the controlled extraction evaluation
with runtime-injected OpenAI credentials. It must retain the existing relevance,
kind, and URL-grounding thresholds and add zero Russian-description violations.
Inspect a bounded aggregate/sample report without storing source text or raw
responses.

Review the final diff:

```sh
git diff --check
git status --short
git diff --stat
git diff -- . ':!apps/web/app/**'
```

Expected: no whitespace errors; only in-scope files changed; no unrelated web
work is staged; every verification passes.

### Step 11: Open the feature PR and complete controlled production activation

After offline gates:

1. Open the draft feature PR and complete code/migration/security review.
2. In Telegram, create or select the EN and RU broadcast channels. Create a
   dedicated bot and grant it only the rights necessary to post messages.
3. Confirm the two targets are distinct and absent from `TELEGRAM_CHANNELS`.
4. Create the private Railway `digest` service in the existing project and
   production environment, configure `/railway.digest.json`, and give it no
   domain.
5. Set only the allowlisted variables. Use the Postgres reference variable.
6. Choose `DIGEST_INITIAL_START_AT` from the last completed parser run before
   activation and confirm the resulting item count in a non-sending database
   preview/diagnostic. STOP if it exceeds the expected weekly range; do not
   broadcast a surprise backlog.
7. Apply the additive migration with the existing API migration-owner process.
   Confirm the API and parser still pass readiness/sync checks before publishing.
8. Run one controlled digest invocation. Verify both channels, every message
   part, fields, language, links, stars, and the site link.
9. Invoke it again immediately. It must be a no-op with no second channel post.
10. Simulate or use a fake target in a controlled non-production channel to
    prove partial resume without duplicating the successful target. Do not break
    a real public channel for this test.
11. Confirm the Monday 09:00 UTC schedule is active and the service has no
    domain/restart loop.

When review is approved, merge the single feature PR. Record the PR URL and the
controlled run ID in `plans/README.md` without recording credentials or target
IDs. Mark Plan 005 `DONE` only after both languages have been observed in the
intended channels and the immediate repeat was a no-op.

## Test plan

### Unit and contract tests

- `analysis-schema.test.ts`: both descriptions, grounded main/GitHub links,
  invalid repository routes, invented links, strict extra-field rejection.
- `openai-post-analyzer.test.ts`: updated strict schema request and metadata;
  `store: false`, no tools, no raw response retention.
- `extraction-eval.test.ts`: dual-URL grounding and zero Russian-description
  violations.
- `github-stars.test.ts`: separate GitHub URL preferred, canonical fallback,
  identical links, stale metadata clearing, zero stars.
- `config.test.ts`: valid EN/RU targets, normalization, distinctness, URL and
  initial-time bounds, attempt/timeout bounds, credential-safe errors.
- new renderer tests: localized field contract, escaping, link selection,
  length/splitting, empty digest, deterministic rerender.
- new Bot API client tests: success, safe retries, ambiguity, malformed
  response, error redaction.
- new coordinator tests: windowing, first run, interval no-op, snapshots,
  partial resume, crash states, resolver, aggregate output.

### Disposable PostgreSQL integration

- migrate a clean test database;
- prove new nullable columns do not break existing rows;
- prove new analyzed candidates project both language/link fields;
- prove selection uses the fixed eligibility floor, prior-snapshot exclusion,
  and shared visibility, including delayed visibility carryover;
- prove snapshot/outbox constraints and partial-resume state transitions;
- prove concurrent lock exclusion;
- rerun all pre-existing API/catalog/pipeline integration tests.

### Controlled external acceptance

- OpenAI evaluation passes the prior thresholds plus the RU constraint.
- Bot has `can_post_messages` in only the intended owner-managed targets.
- EN content is English and RU content is Russian.
- Every item contains all available requested fields.
- Main and GitHub links are not duplicated when identical.
- Null stars are omitted; zero stars are shown.
- Every message part links to the public site.
- Empty-week format includes the site link.
- Multi-part order is stable and labels show part numbers.
- Immediate rerun sends nothing.
- Partial resume never repeats a delivery already marked `SENT`.
- No bot token, chat ID, source post body, or message HTML appears in service
  logs.

## Done criteria

All must hold:

- [ ] Work is isolated to `codex/weekly-telegram-digests` and one feature PR.
- [ ] `npm run check` exits 0.
- [ ] All disposable-PostgreSQL integration tests, including digest tests, pass.
- [ ] The additive migration applies cleanly twice and preserves existing rows.
- [ ] The service image builds, runs as `node`, and contains working digest help.
- [ ] New extractions contain bounded EN and RU descriptions and grounded main
      and GitHub URLs.
- [ ] Existing rows remain valid without fabricated RU/GitHub backfill.
- [ ] GitHub enrichment prefers the separate repository URL and still supports
      repository-only canonical URLs.
- [ ] Digest selection is durable, visibility-aware, based on
      `CatalogItem.createdAt`, and carries eligible never-announced items across
      an earlier invisible week without duplicating snapshots.
- [ ] Every EN/RU message part includes the site link and requested item fields.
- [ ] HTML injection and over-limit message cases are covered and safe.
- [ ] Per-delivery state resumes partial runs without resending `SENT` rows.
- [ ] Ambiguous sends require explicit single-delivery resolution.
- [ ] Bot token and destination configuration exist only on the private digest
      service and never appear in logs or committed files.
- [ ] Output channels are not ingestion sources.
- [ ] `railway.digest.json` schedules Monday 09:00 UTC with `NEVER` restart and
      no domain.
- [ ] Controlled live EN and RU messages pass visual/link inspection.
- [ ] Immediate repeat is a verified no-op.
- [ ] Business/product and operations documentation reflects the narrow outbound
      digest exception.
- [ ] PR review approves migration, outbound side effects, and rollback.
- [ ] Plan 005 status is updated with the PR URL and safe acceptance summary.

## STOP conditions

Stop and report; do not improvise if:

- current Telegram Bot API docs no longer support the assumed channel post,
  formatting, or permission contract;
- the two channels are not owner-managed, cannot grant the dedicated bot
  `can_post_messages`, or are the same target;
- an output channel is present in `TELEGRAM_CHANNELS` and cannot be removed;
- implementation would require publishing through the GramJS ingestion user;
- current Railway cron semantics cannot guarantee a one-shot weekly UTC job;
- an in-scope schema, projection, star-refresh, or deployment file materially
  drifted from this plan;
- the migration requires destructive changes or a historical row rewrite;
- the extraction model cannot reliably return a grounded `githubUrl` and a
  Russian description under the controlled evaluation;
- a selected new item lacks `descriptionRu`;
- the initial cutoff would include more than 14 days or an unexpectedly large
  number of items;
- a delivery is left `SENDING` or has an ambiguous network outcome and the owner
  has not confirmed whether the channel post exists;
- a rendered item cannot fit under conservative message limits without
  truncating required content;
- verification would require real production credentials in a command, log,
  fixture, PR, or plan file;
- a step requires changing the public API or dirty web files;
- a verification command fails twice after one reasonable scoped correction;
- the final diff contains unrelated work.

## Rollback and maintenance

### Before production activation

Create and complete a manual Railway Postgres backup before applying the
migration. The migration is additive, so application rollback should deploy the
previous API/parser image while retaining new nullable columns and digest tables.
Do not drop the tables or columns during an incident.

### Stop publishing

Disable the `digest` cron first. Revoking the bot token or removing channel
permissions is a secondary containment action, not the normal rollback. The API,
web, parser, and database remain operational without digest runs.

### Partial/ambiguous delivery

Do not delete a run to force progress. Inspect the channel, resolve exactly one
ambiguous delivery as `sent` or `unsent`, then rerun the command. Preserve the
snapshot and message IDs as the operational audit trail.

### Future changes reviewers must watch

- Changing catalog visibility or consolidation can affect which rows are
  snapshotted, but must never mutate existing snapshots.
- Changing extraction schema requires prompt/schema version bumps and controlled
  bilingual/link evaluation.
- Changing the public site origin affects future rendered deliveries only;
  prepared delivery HTML is intentionally immutable.
- Changing Telegram formatting requires rerunning escaping and length tests.
- If exact-once channel posting becomes essential, Telegram's API limitations
  require a new reconciliation design; do not hide ambiguity with automatic
  retries.
- If more languages or targets are requested, create a new plan. Do not turn
  the fixed EN/RU schema into a generic notification platform inside this PR.
