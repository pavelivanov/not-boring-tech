# Plan 004: Build the dynamic production stack on Railway

> **Executor instructions**: Follow this plan in order. Run every verification
> command and confirm the expected result before continuing. Stop on any STOP
> condition instead of improvising. When complete, update Plan 004's row in
> `plans/README.md`.
>
> **Drift check (run first)**: this plan was prepared at commit
> `fcfc6ac13314bd3d6a7140cccc6828c3d47a1981` on 2026-08-03. Run
> `git status --short --branch`, `git rev-parse HEAD`, and
> `git diff fcfc6ac -- plans apps packages scripts railway*.json README.md`.
> Read and preserve intentional changes. If the database, collector write path,
> web data boundary, or Railway topology changed materially, stop and revise this
> plan before implementation.

## Status

- **Priority**: P1
- **Effort**: L (approximately seven to twelve focused days)
- **Risk**: HIGH
- **Depends on**: Plan 003's offline implementation; production activation also
  depends on Plan 003's controlled live credential gates
- **Category**: feature / infrastructure
- **Planned at**: `fcfc6ac13314bd3d6a7140cccc6828c3d47a1981`, 2026-08-03

## Outcome

The production Railway project contains exactly these application services:

1. `web` — the public React application used to preview, search, and filter the
   catalog.
2. `api` — the public, read-only Hono API used by the browser.
3. `Postgres` — Railway-managed PostgreSQL, reachable by application services
   over Railway private networking and never exposed as an application domain.
4. `parser` — a private, one-shot cron service that reads only configured public
   Telegram channels, analyzes new posts, updates the catalog, and exits.

They live in one Railway project and one production environment. They are not
four Railway projects. The `api` and `parser` services may use the same
`@findthatproject/service` image because `apps/service/src/server.ts` and
`apps/service/src/sync.ts` are already separate entry points; their Railway
service names, commands, variables, health behavior, and scaling remain
independent.

The production data flow is:

```text
TELEGRAM_CHANNELS
       │
       ▼
parser cron ──▶ private Postgres ──▶ read-only API ──▶ web browser
```

`TELEGRAM_CHANNELS` is the only manually configured content-source list. Every
catalog row, mention, channel title, count, tag, category facet, and filter value
shown in production must originate from a successful parser run and PostgreSQL.

## Non-negotiable production-data rule

Production must contain no checked-in catalog corpus and no fixture fallback.

Allowed static code/configuration:

- the `TELEGRAM_CHANNELS` environment variable;
- API schemas, controlled enums, validation rules, UI labels, icons, and empty,
  loading, and error copy;
- small synthetic test fixtures under test-only paths that production modules do
  not import and production builds do not bundle.

Forbidden in production:

- hard-coded tools, presentations, mentions, channel metadata, tags, categories,
  counts, timestamps, or slugs;
- seeding the current curated web corpus into PostgreSQL;
- serving the current fixture corpus while the API, database, or parser is empty
  or unavailable;
- importing test fixtures from runtime modules;
- a build-time snapshot of database rows.

An empty database is a valid state. The web app must say that no parsed entries
exist yet and explain that the catalog will populate after a parser run. An API
failure is a distinct retryable error state. Neither state may display sample
tools.

Schema/configuration enums do not violate this rule because they constrain
parsed values; they are not presentation records. Filter options still come
from the API's live facet response rather than from enum iteration in the web
app.

## Why this is needed

The current production deploy is a static prototype:

- `apps/web/app/data/tools.ts:43-1024` embeds the catalog and derived facets.
- `apps/web/app/data/channels.ts:3-30` embeds production channel metadata.
- `apps/web/app/routes/home.tsx:21-90` imports those arrays and filters them in
  the browser.
- `apps/web/app/routes/tool-detail.tsx:12-13` resolves details from a static map.
- `apps/web/react-router.config.ts:3-17` derives prerender paths from the static
  corpus and disables SSR.
- `apps/service/src/server.ts:7-25` exposes only `/health` and `/ready`.
- `packages/db/prisma/schema.prisma:89-107` stores per-post
  `PresentationCandidate` rows but has no stable, canonical catalog projection.
- `railway.json:1-14` builds and starts only the web application.

The collector foundation is already appropriate:

- `apps/service/src/sync.ts:11-52` performs one bounded run and exits.
- `apps/service/src/sync.ts:14-19` protects against overlap with a PostgreSQL
  advisory lock.
- `apps/service/src/config.ts:43-92` validates the authoritative channel list and
  parser secrets.
- `apps/service/src/collector/collect-channel.ts:226-270` replaces structured
  candidates atomically when an analyzed post changes.
- `apps/service/Dockerfile:26-45` contains both compiled entry points and defaults
  to the API/server entry point.

This plan connects those pieces without retaining the prototype as a hidden
production data source.

## Architectural decisions

### One codebase, four Railway services

Use one GitHub-connected Railway project. Connect `main` to the three code
services. Configure each service with a service-specific Railway config file;
do not rely on the current root `railway.json` for all three processes.

| Railway service | Source / image             | Start behavior                     | Network                                  | Health / restart                                                |
| --------------- | -------------------------- | ---------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| `web`           | repository root, web build | serve compiled React app           | public domain                            | `/`, restart on failure                                         |
| `api`           | `apps/service/Dockerfile`  | `node apps/service/dist/server.js` | public domain plus private DB            | `/ready`, restart on failure                                    |
| `Postgres`      | Railway managed template   | managed PostgreSQL                 | private only                             | Railway managed                                                 |
| `parser`        | same service Dockerfile    | `node apps/service/dist/sync.js`   | private DB plus outbound Telegram/OpenAI | cron, no domain, no health check, never restart a completed run |

Railway documents custom start commands for multiple services backed by a
shared monorepo, service reference variables, private PostgreSQL connections,
and `deploy.cronSchedule` in config as code. Re-resolve `/railwayapp/docs` with
Context7 immediately before implementation because Railway settings can change.

### Public read API for the current client-rendered web app

Keep the current `ssr: false` web architecture for this plan. The browser calls
the public `api` domain. The API is read-only and permits CORS only from the
configured production web origin and explicit local development origins. It
never uses wildcard CORS in production and never accepts browser credentials.

`VITE_API_BASE_URL` is public configuration embedded at web build time. It is
not a secret. PostgreSQL, Telegram, and OpenAI variables must never be available
to the web build or browser.

This decision minimizes the migration surface. A later plan may add SSR for
per-item social metadata. Until then, the item route uses generic static page
metadata and loads the item dynamically; it must not prerender paths from data.

### Durable catalog projection

Do not expose `PresentationCandidate` rows directly as independent tools. A post
can mention an existing subject, multiple posts can describe the same subject,
and edits can replace candidates. Add a durable catalog projection with stable
identity and slugs while preserving every source mention.

Recommended schema shape:

```text
CatalogItem
  id, identityKey (unique), slug (unique), kind, category,
  name, parentName?, canonicalUrl?, descriptionEn, tags[],
  firstMentionedAt, lastMentionedAt, createdAt, updatedAt

PresentationCandidate
  ...existing fields..., catalogItemId? -> CatalogItem
```

The existing `PresentationCandidate -> AnalyzedPost -> Channel` path remains the
source of mention provenance. Do not copy raw Telegram text into the catalog.

Identity rules must be deterministic and covered by fixtures:

1. If a grounded `subjectUrl` exists, canonicalize its HTTP(S) URL, remove the
   fragment and known tracking parameters, normalize host casing/default ports,
   and use the canonical URL as the primary identity key.
2. Otherwise use a normalized tuple of `kind`, `parentName`, and `name`.
3. Never automatically merge two different non-null canonical URLs just because
   names match.
4. Store a generated slug once. Resolve collisions with a deterministic short
   identity suffix; do not change existing slugs when display names change.
5. Select display fields deterministically from linked candidates (highest
   confidence, then newest publication date, then candidate ID), union normalized
   tags, and recompute first/last mention timestamps.
6. When a post is reanalyzed, collect the old and new item IDs and refresh both
   sets in the same transaction as candidate replacement or in an idempotent
   transaction immediately following it.
7. Retain orphaned catalog rows for slug stability, but hide any item with zero
   visible mentions. A visible mention must come from a terminal relevant post
   in a channel currently enabled by `TELEGRAM_CHANNELS` reconciliation.

Automatic merge/split administration remains out of scope. Ambiguous candidates
stay separate rather than risking an irreversible merge.

### Parsed classification, dynamic facets

Preserve the design's category filter by extending the structured extraction
contract with one required controlled category. The category enum is code, but
the value stored for an item comes from the parser. Re-run the synthetic and
controlled extraction evaluation after changing the schema/prompt/version.

Start with the approved prototype taxonomy: `AI development`,
`AI productivity`, `Creative AI`, `Data systems`, `Design`, `Developer tools`,
`Frontend`, `Infrastructure`, `Learning resources`, `Operations`, and
`Security`. Add `Other` as an explicit reviewed fallback rather than accepting
arbitrary model-authored category strings. Taxonomy changes require a contract
and analysis-version change; the web still displays only values present in live
facets.

The API derives all available categories, kinds, channels, and tags from visible
database rows. The web must not create filter options by iterating hard-coded
arrays. If a facet has no live values, omit or disable its control.

## API contract

Place transport DTOs and query enums in `@findthatproject/contracts`; never expose
Prisma-generated types to the web. Validate API input and output at the service
boundary.

Minimum endpoints:

| Endpoint                | Behavior                                               |
| ----------------------- | ------------------------------------------------------ |
| `GET /health`           | process liveness; no database dependency               |
| `GET /ready`            | database readiness and required-schema check           |
| `GET /v1/catalog`       | filtered, sorted, cursor-paginated visible items       |
| `GET /v1/catalog/:slug` | one visible item with all visible source mentions      |
| `GET /v1/facets`        | live categories, kinds, channels, and tags with counts |
| `GET /v1/channels`      | enabled parsed channels with display metadata          |

`GET /v1/catalog` supports the URL-backed product filters:

- `q`: trimmed text query over name, parent, description, tags, and canonical
  URL;
- repeated `kind`, `category`, `channel`, and `tag` values;
- `sort=latest|name|stars`;
- opaque `cursor` and bounded `limit` (default 24, maximum 100).

Use stable keyset pagination (`firstMentionedAt` plus `id` for latest, normalized
name plus `id` for name, and nulls-last `githubStars` plus `id` for stars), never
offset pagination. A malformed query returns a safe `400`; an unknown or hidden
slug returns `404`; unexpected failures return a non-sensitive request ID and
`500`. Serialize PostgreSQL `BigInt`, dates, and decimals explicitly.

List responses include `items`, `nextCursor`, and the normalized active filter
state. Detail responses include source URL, channel ID/handle/title, published
date, and candidate confidence for every visible mention. They contain no post
body, prompt, model response, internal ledger error, secret, or private database
identifier.

For the first production version, implement deterministic PostgreSQL text
matching with appropriate indexes. Embeddings, semantic retrieval, reciprocal
rank fusion, and relevance tuning remain a later plan; do not block this dynamic
data migration on them.

## Environment and secret matrix

| Variable                                           | web | api |   parser | Source                                                       |
| -------------------------------------------------- | --: | --: | -------: | ------------------------------------------------------------ |
| `VITE_API_BASE_URL`                                | yes |  no |       no | API public domain reference / explicit URL                   |
| `API_ALLOWED_ORIGINS`                              |  no | yes |       no | web public domain plus explicit local origins                |
| `DATABASE_URL`                                     |  no | yes |      yes | reference to `Postgres.DATABASE_URL` over private networking |
| `HOST`, `PORT`, `LOG_LEVEL`                        |  no | yes | optional | Railway/runtime configuration                                |
| `TELEGRAM_CHANNELS`                                |  no |  no |      yes | owner-approved comma-separated public handles                |
| `TELEGRAM_API_ID`                                  |  no |  no |      yes | Railway secret                                               |
| `TELEGRAM_API_HASH`                                |  no |  no |      yes | Railway secret                                               |
| `TELEGRAM_SESSION`                                 |  no |  no |      yes | Railway secret                                               |
| `TELEGRAM_BACKFILL_DAYS`, `TELEGRAM_PAGE_SIZE`     |  no |  no |      yes | bounded parser configuration                                 |
| `OPENAI_API_KEY`, `OPENAI_MODEL`                   |  no |  no |      yes | Railway secret/configuration                                 |
| `OPENAI_REQUEST_TIMEOUT_MS`, `OPENAI_MAX_ATTEMPTS` |  no |  no |      yes | bounded parser configuration                                 |

Do not upload a shared `.env.production` to every service. Change the existing
environment-push/deploy scripts so they know `web`, `api`, and `parser` as
different variable scopes and never print values. Prefer Railway reference
variables over copying the database password.

## Target repository changes

Exact filenames may follow current conventions, but ownership must stay clear:

```text
apps/
├── service/
│   ├── src/
│   │   ├── catalog/              # identity, projection, query functions
│   │   ├── config.ts             # separate API and parser schemas
│   │   ├── server.ts             # health/readiness plus /v1 read API
│   │   └── sync.ts               # one-shot parser plus projection updates
│   └── test/
│       ├── catalog.integration.test.ts
│       └── api.integration.test.ts
└── web/
    └── app/
        ├── data/api-client.ts     # the only production catalog data adapter
        ├── routes/home.tsx
        └── routes/tool-detail.tsx
packages/
├── contracts/src/index.ts        # validated API DTOs/query contract
└── db/prisma/
    ├── schema.prisma
    └── migrations/..._catalog_projection/
railway.web.json
railway.api.json
railway.parser.json
scripts/railway-deploy.sh
scripts/railway-env-push.sh
```

Delete these production corpus modules after their callers are migrated:

```text
apps/web/app/data/tools.ts
apps/web/app/data/channels.ts
```

Move only small synthetic examples needed by tests into clearly test-only files.
Do not rename or relocate the current curated corpus in order to keep it.

## Implementation sequence

### Step 1: Reconfirm scope, credentials, and current documentation

Run the drift check. Read Plans 003 and 004 fully. Confirm Plan 003's offline
implementation is present and passing. Record which Plan 003 live checks are
still blocked, but do not put credentials into the repository or planning files.

Use the repository-required Context7 workflow to resolve and fetch current docs
for Railway, Hono, Prisma, React Router, and any added runtime library before
using their APIs. Specifically verify Railway monorepo config-file paths,
PostgreSQL reference variables/private networking, cron UTC semantics,
pre-deploy commands, health checks, restart policies, and GitHub autodeploys.

Inspect the linked Railway project read-only. It is expected to contain the
current web-only service at plan time. If it contains unrelated data-bearing
services, a different project/environment, or unexpected production resources,
stop before provisioning or renaming anything.

**Verify**:

```sh
git status --short --branch
git rev-parse HEAD
npm run check
railway status --json
railway service list --json
```

Expected: repository gates pass; the executor can name the exact Railway project,
environment, current service, and pending four-service target. Missing live
Telegram/OpenAI credentials blocks Steps 9-10, not the offline implementation.

### Step 2: Define transport and classification contracts

Replace the prototype-only `Tool` assumptions with explicit catalog list,
detail, mention, facet, pagination, and API-error DTOs in
`@findthatproject/contracts`. Add the controlled category to the parser's strict output
schema and increment prompt/schema/analysis versions. Keep ORM types private.

Create small synthetic contract fixtures that contain no copied production
catalog row or Telegram post. Test bounds, enums, dates, URL fields, optional
parent/canonical URL, cursor shape, and multiple mentions.

**Verify**:

```sh
npm run typecheck --workspace=@findthatproject/contracts
npm run test --workspace=@findthatproject/service -- --run analysis-schema
npm run test --workspace=@findthatproject/service -- --run extraction-eval
```

Expected: transport types compile; parser output stays strict; offline extraction
evaluation meets its existing threshold with the new category field.

### Step 3: Add the canonical catalog schema and safe migration

Add `CatalogItem`, the nullable candidate relation, unique identity/slug
constraints, visibility query indexes, and category storage. Write forward-only
migration SQL. The migration must not drop or rewrite existing candidate,
ledger, cursor, or run data.

Implement a bounded backfill projector that links existing structured candidates
without inventing items from web fixtures. It must be idempotent and resumable.
If production candidates already exist, snapshot counts before and after and
retain every provenance path.

**Verify**:

```sh
npm run db:validate --workspace=@findthatproject/db
npm run generate --workspace=@findthatproject/db
npm run build --workspace=@findthatproject/db
docker compose up -d db
docker compose run --rm migrate
```

Expected: a clean database and an existing-candidate test database both migrate;
no destructive SQL appears; rerunning deployment migration exits successfully.

### Step 4: Implement deterministic catalog projection in the parser

Implement URL/name normalization, identity selection, stable slug allocation,
candidate linking, aggregate refresh, orphan hiding, and affected-item refresh
after edits. Integrate it with the existing candidate transaction so a successful
parser run cannot leave visible partially updated data.

Use fakes and disposable PostgreSQL to cover same-subject mentions, URL variants,
same-name/different-URL separation, slug collision, edit relocation, relevant to
irrelevant transition, disabled/re-enabled channels, crash retry, and concurrent
sync rejection. Do not log candidate descriptions or post contents.

**Verify**:

```sh
npm run test --workspace=@findthatproject/service -- --run catalog
npm run test --workspace=@findthatproject/service -- --run pipeline
```

Expected: projector and existing ingestion tests pass; repeated runs create no
duplicate items; edits refresh both old and new identities; disabled-only items
are absent from visible queries without deleting provenance.

### Step 5: Build the read-only Hono API

Add the `/v1` endpoints, validated query parsing, stable pagination, safe error
mapping, explicit DTO serialization, CORS allowlist, and request IDs. Keep
`/health` database-independent. Make `/ready` fail if PostgreSQL is unavailable
or the required catalog migration is missing.

Centralize catalog queries outside route handlers. Enforce visibility through a
shared database predicate so list, detail, facets, and channel endpoints cannot
disagree about disabled channels or orphaned items.

**Verify**:

```sh
npm run test --workspace=@findthatproject/service -- --run server
npm run test --workspace=@findthatproject/service -- --run api
npm run typecheck --workspace=@findthatproject/service
```

Expected: endpoints pass list/detail/filter/facet/pagination/error/CORS tests;
responses contain only contract fields; hidden items are 404; invalid cursors are
400; database failures are sanitized.

### Step 6: Replace the web fixture boundary with the API

Create one production API adapter that reads `VITE_API_BASE_URL`, encodes the
existing URL-backed filters, validates responses, and supports cancellation.
Migrate the home and detail routes to it. Preserve the approved visual design,
but derive results, counts, channel labels, categories, kinds, and tags only from
API responses.

Add accessible skeleton/loading, zero-data, zero-filter-results, retryable API
error, and not-found states. Keep filter changes reflected in the URL. Remove
static prerender slug generation. Generic route metadata is acceptable in this
client-rendered phase; it must not import item data.

Rewrite route tests against an in-memory HTTP/API fake or injected adapter using
synthetic records. Delete fixture-corpus tests and the two runtime corpus files.

**Verify**:

```sh
! rg -n "~/data/(tools|channels)|data/(tools|channels)" apps/web/app
test ! -e apps/web/app/data/tools.ts
test ! -e apps/web/app/data/channels.ts
npm run test --workspace=@findthatproject/web
npm run typecheck --workspace=@findthatproject/web
npm run build --workspace=@findthatproject/web
```

Expected: the web works with synthetic API responses and all empty/error states;
no production module imports catalog fixtures; arbitrary runtime slugs resolve
through the API rather than a build-time list.

### Step 7: Add service-specific Railway configuration and operations scripts

Replace the single web-only Railway configuration with three service-specific
config files and document the Railway dashboard config-file path assigned to each
service. Use the repository root as the shared monorepo build context.

- `web`: build/start the web workspace; `/` health check; failure restart.
- `api`: build with `apps/service/Dockerfile`; run `migrate:deploy` as the sole
  migration owner before starting; `/ready` health check; failure restart.
- `parser`: same image, sync start command, UTC schedule `0 */12 * * *`, no
  health check/domain, and no automatic restart after process exit.

If current Railway docs do not permit all three service configs to coexist by
dashboard-configured file path, use the documented per-service settings instead
and keep checked-in files as the auditable intended values. Do not create a
second Railway project to work around config discovery.

Update deployment scripts to recognize `web`, `api`, and `parser`, wait for
long-running service health separately from a completed cron run, and refuse
unknown services/environments. Update environment helpers to keep parser secrets
out of web/API and to prefer reference variables. Add a dry-run or printed
key-name-only inspection path.

**Verify**:

```sh
npx prettier --check 'railway*.json'
bash -n scripts/railway-deploy.sh scripts/railway-env-push.sh
npm run deploy:railway -- --help
```

Expected: configs validate against current Railway expectations, scripts parse,
help lists all three code services, and no command output contains secret values.

### Step 8: Prove the production build has no static catalog

Run the complete offline suite, build production artifacts, and inspect them.
Use several distinctive former fixture names/slugs, not generic words, as
sentinels. Search runtime source and built web output; exclude tests, plans,
source maps, and build metadata only when justified and documented.

Also prove a clean empty PostgreSQL database produces an empty API list/facet
response and the honest web empty state. Then insert only synthetic parser output
through the parser/projector test boundary and prove it appears dynamically.

**Verify**:

```sh
npm run check
test -d apps/web/build/client
! rg -n "claude-code-channels|owner-approved corpus" apps/web/build/client
! rg -n "export const (tools|channels)" apps/web/app --glob '!**/*.test.*'
```

Expected: every workspace gate passes; production bundles contain none of the
former catalog; empty and parser-populated flows both work without source edits
or rebuild-time catalog injection.

### Step 9: Provision and deploy the four-service Railway project

This step changes external production state. Resolve the exact linked project
and environment before mutation, preserve the current web domain if possible,
and use recoverable renames. Do not delete the current service until the new web
deployment is healthy.

Provision in this order:

1. Rename/reconfigure the existing code service to `web` or create `web` beside
   it for a verified cutover.
2. Add Railway-managed `Postgres`; record a backup/restore path before migrating
   any existing data.
3. Add `api`, connect it to GitHub `main`, set its config path, reference
   `Postgres.DATABASE_URL`, create its public domain, run migrations, and verify
   `/health` plus `/ready`.
4. Set `VITE_API_BASE_URL` and `API_ALLOWED_ORIGINS` from the actual two public
   domains, deploy `web`, and exercise empty/error/list/detail/filter states.
5. Add `parser`, connect the same GitHub source, set the parser config path,
   database reference, channel list, and secrets. Give it no public domain.
6. Run one manual bounded parser deployment/job before enabling twice-daily cron.
7. Enable the cron only after the manual run, database inspection, API response,
   and web rendering all pass.

Use Railway reference variables for cross-service values. Read back service
settings and variables by key name after writing them. Never paste or echo
credential values into commands captured in logs, plans, or chat.

**Verify**:

```sh
railway status --json
railway service list --json
railway deployment list --service web --limit 1 --json
railway deployment list --service api --limit 1 --json
railway deployment list --service parser --limit 1 --json
```

Expected: one project/environment shows `web`, `api`, `parser`, and managed
Postgres; latest web/API deployments are successful; the manual parser run
completed successfully; only web/API have public domains; database traffic uses
the private reference URL.

### Step 10: Complete live data and browser acceptance

Use only owner-approved public handles in `TELEGRAM_CHANNELS`. Complete Plan
003's outstanding controlled OpenAI/Telegram, repeat-sync, edit, and hygiene
checks first or alongside the bounded manual parser run. Inspect aggregate counts
and structured fields, never raw post bodies.

Verify end to end:

1. Before the first parser run, web shows no parsed entries and no fixture data.
2. The bounded parser run creates channel/candidate/catalog rows only for the
   configured handles.
3. API list, detail, facets, and channels reflect those rows.
4. Web preview, search, and every offered filter reflect the API.
5. A second unchanged parser run creates no duplicates and avoids repeat model
   calls under Plan 003's rules.
6. Removing a handle disables future collection and hides its exclusively sourced
   items without deleting provenance; re-adding it restores visibility.
7. Logs, API responses, HTML/JS, and Railway variables visible to web contain no
   Telegram/OpenAI/PostgreSQL secrets or raw post bodies.

Enable twice-daily cron only after all seven pass. Record the UTC schedule and
the next expected run in the deployment handoff.

## Test plan

### Unit

- URL and name identity normalization, including tracking parameters and Unicode.
- Stable slug generation and collision suffixes.
- Display-field precedence and normalized tag union.
- DTO validation, query parsing, cursor signing/decoding if used, and safe errors.
- API client URL construction, abort behavior, validation, and error mapping.
- Parser category schema, semantic invariants, and version changes.

### Disposable PostgreSQL integration

- Migration on empty and existing Plan 003 schemas.
- Candidate-to-item backfill is resumable and idempotent.
- Same URL variants merge; different non-null URLs do not.
- Same fallback identity links; ambiguous candidates remain separate.
- Edits move candidates and refresh old/new items.
- Disabled-only/orphan items remain stored but invisible.
- List/detail/facets/channels share the same visibility boundary.
- Filter combinations and all keyset sort orders do not skip/duplicate rows.
- Readiness fails when the catalog migration is absent.

### Web integration

- Loading, empty database, zero filtered results, API failure/retry, and 404.
- Search and filters round-trip through the URL and API request.
- Facet controls come only from the API response.
- Result card and detail mention provenance preserve the approved design.
- No fixture appears when the fake API returns empty or fails.

### Production acceptance

- Four services visible in one Railway project/environment.
- Web and API domains healthy; Postgres and parser have no public domain.
- Manual parser run followed by successful scheduled execution.
- Configured-channel-only database/API/browser output.
- Empty-before-parse state and dynamic-after-parse state.
- Repeat-run idempotency, edit behavior, and disabled-channel visibility.
- No secrets, raw post bodies, raw model responses, or static corpus in artifacts.

## Commit sequence for the executor

Keep commits reviewable and do not mix Railway mutations with unverified source
changes. Suggested sequence:

1. `feat: add dynamic catalog contracts and schema`
2. `feat: project parsed candidates into catalog items`
3. `feat: expose catalog read API`
4. `feat: load FindThatProject catalog from API`
5. `chore: configure Railway production services`
6. `test: verify dynamic production data boundary`

Before each commit, review `git diff --cached --stat` and
`git diff --cached`. Push/deploy only when the user explicitly requests it and
all preceding gates pass.

## Done criteria

- [ ] One Railway production project visibly contains `web`, `api`, `parser`,
      and managed PostgreSQL.
- [ ] `web` and `api` are GitHub-connected to `main`; parser uses the same source
      with its own command/schedule.
- [ ] Postgres is private; parser has no public domain; only web/API are public.
- [ ] Parser runs once per invocation, is protected from overlap, exits, and is
      scheduled twice daily in UTC.
- [ ] `TELEGRAM_CHANNELS` is the only manual content-source list.
- [ ] Only enabled configured channels contribute visible catalog mentions.
- [ ] Catalog identity, stable slugs, edit refresh, orphan hiding, and provenance
      are deterministic and tested.
- [ ] API list/detail/facet/channel endpoints are validated, paginated, read-only,
      and covered by integration tests.
- [ ] Web preview, search, and filters read only from the API and handle loading,
      empty, failure, zero-result, and 404 states.
- [ ] Hard-coded runtime tools/channels and static slug prerendering are removed.
- [ ] No current curated corpus is seeded into PostgreSQL or bundled in the web.
- [ ] An empty database displays no sample data.
- [ ] Controlled live parser and Plan 003 credential gates pass without leaking
      secrets or raw post/model content.
- [ ] `npm run check`, production artifact inspection, Railway deployment checks,
      and end-to-end browser acceptance all pass.
- [ ] Plans 003/004 statuses and operational documentation accurately reflect the
      final state.

## STOP conditions

Stop and report if:

- repository drift changes the parser transaction, schema, web data boundary, or
  Railway deployment architecture enough to invalidate this plan;
- implementation would retain, rename, seed, fetch as fallback, or bundle the
  checked-in production catalog;
- a database migration drops or irreversibly rewrites existing ledger,
  candidates, cursors, or provenance;
- deterministic identity rules would require guessing between conflicting URLs;
- API endpoints cannot share one enforceable enabled-channel visibility rule;
- production CORS would require `*` or browser access to database/parser secrets;
- current Railway docs cannot establish service-specific monorepo configuration,
  cron behavior, or private Postgres references;
- the linked Railway project/environment or existing resources differ from the
  resolved target;
- provisioning would delete the only healthy web deployment before a recoverable
  cutover exists;
- live Telegram/OpenAI credentials or the owner-approved channel list are absent
  when Steps 9-10 begin;
- a secret, raw Telegram body, raw model response, or former fixture sentinel
  appears in source, logs, database fields, API output, or a production artifact;
- the parser does not terminate cleanly, overlaps despite the advisory lock, or
  Railway retries completed cron runs unexpectedly;
- any verification gate fails twice after a focused correction.

## Rollback and maintenance

- Keep schema changes additive. Roll back application services to the last known
  image while retaining migrated tables; do not down-migrate production data.
- Preserve the old web deployment/domain until the dynamic web and API are both
  healthy. If cutover fails, route traffic back without restoring static data as
  the new system's fallback.
- Disable parser cron before investigating repeated failures. A manual bounded
  run is safer than shortening the schedule.
- Railway database backups and restore drills are operational requirements; they
  do not replace migration review.
- Changing `TELEGRAM_CHANNELS` changes collection and visibility, not historical
  retention. Disabled-channel provenance stays stored.
- Changing prompt/schema/model versions requires the explicit bounded reprocess
  policy from Plan 003; never silently reprocess the entire history.
- SSR/social metadata, embeddings, hybrid ranking, merge/split administration,
  alerting integrations, analytics, authentication, and payments remain separate
  follow-up work.
