# TechDex

TechDex is a focused technology-discovery product. The product direction lives
in the [business plan](business-plan.md), and implementation is sequenced in
the [implementation plans](plans/README.md).

## Prerequisites

- Node.js 22.22.0 or newer
- npm 11.9.0

## Repository layout

- `apps/*` contains deployable applications.
- `packages/*` contains shared packages and configuration.
- `plans/` contains the ordered implementation handoffs.

This repository uses npm workspaces coordinated by Turborepo. It has one
`package-lock.json` at the repository root; do not create nested lockfiles.

## Toolchain baseline

- Turborepo 2.10.7 is installed as the root task runner.
- `turbo.json` was authored directly from Plan 001 rather than generated, so no
  generator-specific configuration differences were introduced.
- Plan 002 is being developed on its own branch after the Plan 001 foundation
  commit.

## Retrieval website

`@techdex/web` is the Plan 002 retrieval prototype in `apps/web`. It uses React
Router Framework Mode on Vite, React, TypeScript, Tailwind CSS, and local
shadcn/ui components. Runtime SSR is disabled: production builds pre-render the
home and about pages into `apps/web/build/client`, with an additional SPA
fallback for runtime `/tools/:slug` paths.

Run website tasks from the repository root:

```sh
# Development server
npm run dev --workspace=@techdex/web

# Unit and route/component tests
npm run test --workspace=@techdex/web

# Watch tests while developing
npm run test:watch --workspace=@techdex/web

# React Router type generation plus TypeScript
npm run typecheck --workspace=@techdex/web

# Formatting check
npm run lint --workspace=@techdex/web

# Production build and prerender
npm run build --workspace=@techdex/web

# Preview the latest production build
npm run start --workspace=@techdex/web
```

The current shadcn CLI no longer accepts the plan's former `radix-nova` preset
name. The equivalent scaffold used the `nova` preset with an explicit Radix
base: `--preset nova --base radix`.

### Dynamic catalog boundary

The production browser reads only the validated API configured by
`VITE_API_BASE_URL`. Catalog rows, counts, categories, kinds, channels, tags,
search results, and arbitrary detail slugs all come from PostgreSQL through that
API. URL-backed filters remain shareable. An empty database has an explicit
empty state, and an unavailable API has a retryable error state; neither state
falls back to sample records.

Subject identity is explicit: records are classified as tools, projects,
libraries, services, products, features, plugins, skills, guides, cheat sheets,
podcasts, or other technology. Features retain a parent name without inheriting
the parent's provenance. Generic news and opinion do not create catalog rows.

## Telegram analysis service

`@techdex/service` is the Plan 003 collection and first-pass analysis service.
It has two processes built into one image:

- `server` exposes `GET /health`, the database-backed `GET /ready`, and
  validated, read-only `/v1/catalog`, `/v1/facets`, and
  `/v1/channels` resources.
- `sync` runs one bounded Telegram collection and OpenAI analysis pass, then
  exits. Synchronization never runs inside the HTTP process.

The service reads only configured public broadcast handles from
`TELEGRAM_CHANNELS`. Adding a handle enables it; removing a handle disables
future collection without deleting its cursor, analysis ledger, or candidates.
It requires a pre-authorized GramJS user `StringSession`; interactive sign-in,
bot tokens, private channels, groups, and dialog discovery are intentionally
unsupported.

### Data and OpenAI boundary

Telegram post text, captions, entity payloads, prompts, and raw OpenAI responses
are transient and are never stored or logged. PostgreSQL retains only source
provenance, a SHA-256 content hash, safe request/usage metadata, processing
status, and structured presentation candidates. Every Responses API request
uses strict Structured Outputs, exposes no tools, and sets `store: false`.

The prompt, schema, configured model, and combined `analysisVersion` are stored
with each ledger record. An unchanged terminal post is not analyzed twice, even
after a configured model change. Reprocessing a historical version will require
an explicit future maintenance operation that refetches Telegram content.

The initial history cutoff is fixed once per channel. A high-watermark cursor
handles new posts while an independent `backfillBeforeMessageId` cursor resumes
the newest-to-oldest historical backfill. Post outcomes commit before page
cursors, so a crash may replay a page but does not duplicate OpenAI charges or
candidate rows. After backfill completes, each later run also refetches one
bounded page at or below the durable high-watermark to detect recent edits;
unchanged content hashes skip OpenAI without rewinding either cursor.

### Configuration

Copy `.env.example` to an ignored local `.env` and replace every placeholder.
The HTTP process requires `DATABASE_URL` and `API_ALLOWED_ORIGINS`; `HOST`,
`PORT`, and `LOG_LEVEL` have bounded defaults.
`SERVICE_PORT` optionally changes only the Compose host binding.
The sync process additionally requires:

- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_SESSION`;
- `TELEGRAM_CHANNELS`, a comma-separated list of 1–10 unique public handles;
- `OPENAI_API_KEY` and an explicit Structured-Outputs-compatible
  `OPENAI_MODEL`;
- optional bounded backfill, page-size, timeout, and attempt settings shown in
  `.env.example`.
- optional `GITHUB_TOKEN` for authenticated repository-star refreshes. Public
  GitHub data still refreshes without it, in smaller batches.

Never prefix server credentials with `VITE_`, bake them into the image, pass
them as build arguments, or commit a working `.env` or Telegram session.

### Local database and service

With `POSTGRES_PASSWORD` exported in the shell or supplied by an ignored `.env`:

```sh
docker compose up -d db
docker compose run --rm migrate
docker compose up -d service
curl --fail http://127.0.0.1:3001/health
curl --fail http://127.0.0.1:3001/ready
```

Run one synchronization pass with runtime-injected credentials:

```sh
docker compose --profile sync run --rm sync
```

The sync exit codes are `0` for success, `2` for a partial run, `75` when the
advisory lock reports another sync already running, and `1` for configuration
or fatal run failure. Output contains only run IDs, statuses, safe error classes,
counts, cursor strings, and aggregate usage.

### Verification and extraction evaluation

The normal repository gate uses no third-party credentials:

```sh
npm run check
```

Database integration tests require the disposable local `techdex_test`
database. Its Compose profile uses tmpfs and refuses non-loopback or non-test
database URLs:

```sh
POSTGRES_PASSWORD=unused docker compose --profile test up -d db-test
DATABASE_URL=postgresql://techdex_test:techdex_test@127.0.0.1:5433/techdex_test \
  npm run migrate:deploy --workspace=@techdex/db
TEST_DATABASE_URL=postgresql://techdex_test:techdex_test@127.0.0.1:5433/techdex_test \
  npm run test --workspace=@techdex/service -- --run pipeline
```

The checked-in extraction evaluation uses 30 compact synthetic cases and prints
aggregate metrics only. A controlled live run needs only the OpenAI evaluation
variables, not database or Telegram credentials:

```sh
OPENAI_API_KEY=replace-at-runtime \
OPENAI_MODEL=replace-with-an-explicit-compatible-model \
  npm run eval:extraction --workspace=@techdex/service
```

Acceptance requires relevance precision of at least 0.90, relevance recall of
at least 0.85, kind accuracy of at least 0.85, and zero URL-grounding violations.
The controlled 30-case run on 2026-08-03 passed at 1.00 precision, 1.00 recall,
1.00 kind accuracy, and zero URL-grounding violations after the versioned prompt
made every application-side semantic invariant explicit.

## Railway service layout

All code services use the repository root as their shared monorepo build
context. Set these absolute config-file paths in each Railway service's Settings
panel:

| Service  | Config path            | Runtime behavior                                              |
| -------- | ---------------------- | ------------------------------------------------------------- |
| `web`    | `/railway.web.json`    | public SPA, `/` health check                                  |
| `api`    | `/railway.api.json`    | public read API, migration owner, `/ready` health check       |
| `parser` | `/railway.parser.json` | private one-shot sync, `0 */12 * * *` UTC cron, never restart |

The managed database service is named `Postgres`. Both `api` and `parser` must
receive `DATABASE_URL=${{Postgres.DATABASE_URL}}` as a Railway reference
variable; `web` never receives database or parser credentials. Only `parser`
receives Telegram, OpenAI, and optional GitHub credentials, and it must not have
a public domain. Each 12-hour parser run refreshes GitHub-backed catalog star
counts after collection; conditional requests avoid re-downloading unchanged
repository metadata.

Railway environment files are local and ignored:

- `.env.railway.web` accepts only public `VITE_` origins;
- `.env.railway.api` accepts the database reference, CORS origins, and safe
  server settings;
- `.env.railway.parser` accepts the database reference and parser-only secrets.

Validate a file and print key names without changing Railway:

```sh
npm run railway:env -- parser --dry-run
```

Deploy scripts accept only `web`, `api`, and `parser` in the `production`
environment. The API waits on `/ready`; a parser deployment is treated as a
one-shot process and receives no HTTP health check.

```sh
npm run deploy:railway -- --help
```

### Current production acceptance state

The Railway `production` environment contains public
[`web`](https://not-boring-tech-production.up.railway.app) and
[`api`](https://api-production-648c.up.railway.app) services plus private
`Postgres` and `parser` services. The initial bounded parser run analyzed 413
posts from four configured public channels and produced 187 visible catalog
items; an unchanged second run made zero OpenAI analyses. A controlled
channel disable/re-enable check reduced the visible catalog to 167 items while
all 187 catalog rows, 199 candidates, and 413 analyzed-post ledgers remained
stored, then restored all four channels and 187 visible items.

The parser is private with no domain, connected to GitHub `main`, and scheduled
at `0 */12 * * *` UTC with restart policy `NEVER`. A controlled scheduled run
completed successfully on 2026-08-03 with 200 recent posts fetched, all 200
skipped by unchanged content hash, zero OpenAI analyses, and zero failed
channels; the next normal run was recorded as 2026-08-04 00:00 UTC.

The owner explicitly waived the live Telegram edit transition on 2026-08-03.
Bounded recent-edit detection is implemented and covered by disposable-database
integration tests, but this handoff does not claim that a real edited Telegram
post was observed in production.

### Production database recovery

The production database is the private Railway-managed service named
`Postgres`. Before any future destructive or data-rewriting migration, create a
manual volume backup from **Postgres → Backups** in the Railway dashboard and
wait for it to complete. Restore by selecting that backup from the same service;
disable the parser cron and stop API writes before starting a restore. The
initial catalog migration is forward-only and additive, so application rollback
uses the previous API/parser image while retaining the migrated tables.

## Commands

Run a task across all workspaces from the repository root:

```sh
npm run <task>
```

Target a single workspace by package name:

```sh
npm run <task> --workspace=<name>
```

Available root tasks:

- `npm run dev` starts workspace development tasks.
- `npm run build` builds all workspaces.
- `npm run lint` runs workspace linters.
- `npm run typecheck` checks workspace TypeScript.
- `npm run test` runs workspace tests.
- `npm run check` runs lint, typecheck, test, and build as the full local gate.
