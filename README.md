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
home page, the about page, and every known `/tools/:slug` page into
`apps/web/build/client`, with an additional SPA fallback for unknown paths.

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

### Fixture-only boundary

The website has no backend or network data source. It reads checked-in
TypeScript fixtures and runs deterministic local filtering over them. Text
search is intentionally hidden for now and can return as a later feature.

The current 58 subject identities and canonical URLs are real. The corpus uses
verified public mentions from the owner-approved `@notboring_tech` and
`@ctodaily` channels for every current record. `@ai_newz` and `@denissexy` are
also registered as owner-approved sources for subsequent collection. The owner
approved the audited corpus on 2026-07-31; cross-channel coverage is not a
prototype requirement. Plan 002's website gate is complete.

Subject identity is explicit: records are classified as tools, projects,
libraries, services, products, features, plugins, skills, guides, cheat sheets,
podcasts, or other technology. Features link to their parent record, but their
source mentions are never inherited by that parent. Related projects, plugins,
guides, and cheat sheets also remain separate records. Generic news and opinion
do not create indexed records.

`apps/web/app/data/subject-audit.ts` captures 59 source-level regression cases
from the full corpus audit. The fixture invariant tests require each reviewed
post to resolve to exactly its audited primary subject or to no subject. The
current deterministic query cases remain dormant implementation notes for the
future search feature and are not part of the Plan 002 gate.

Cards expose their Telegram source channels as filter chips. Category, source
channel, and tag filters are URL-backed and shareable. Do not use these fixtures
as collector, API, or database seed data.

## Telegram analysis service

`@techdex/service` is the Plan 003 collection and first-pass analysis service.
It has two processes built into one image:

- `server` exposes only `GET /health` and the database-backed `GET /ready`.
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
candidate rows.

### Configuration

Copy `.env.example` to an ignored local `.env` and replace every placeholder.
The HTTP process requires only `DATABASE_URL`, `HOST`, `PORT`, and `LOG_LEVEL`.
`SERVICE_PORT` optionally changes only the Compose host binding.
The sync process additionally requires:

- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_SESSION`;
- `TELEGRAM_CHANNELS`, a comma-separated list of 1–10 unique public handles;
- `OPENAI_API_KEY` and an explicit Structured-Outputs-compatible
  `OPENAI_MODEL`;
- optional bounded backfill, page-size, timeout, and attempt settings shown in
  `.env.example`.

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
Canonicalization, cross-post deduplication, classification, embeddings, public
search APIs, scheduling, and deployment remain separate follow-up work.

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
