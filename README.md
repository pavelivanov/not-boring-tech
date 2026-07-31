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
