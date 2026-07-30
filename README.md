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
TypeScript fixtures and runs deterministic local search over them.

The current 40 tool identities and canonical tool URLs are real. The corpus now
includes owner-approved public mentions from `@notboring_tech` for Cursor,
Claude Code, GitHub Copilot, Ollama, and Docker. All other Telegram channel
identities, source-post URLs, presentation dates, and collection dates remain
explicit interface-development placeholders. The current retrieval evaluation
cases are also temporary behavior checks, not owner-written acceptance queries.

Do not:

- present the placeholder Telegram links or dates as real provenance;
- use these fixtures as collector, API, or database seed data;
- mark Plan 002 `DONE` or begin Plan 003 based on the temporary corpus.

Before completing Plan 002, replace the placeholders with an owner-approved
public-channel corpus and at least 15 owner-written retrieval cases, then rerun
the retrieval, browser, and repository gates.

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
