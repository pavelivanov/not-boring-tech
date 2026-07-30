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
- The implementation began after the repository's initial documentation commit;
  no additional branch or commit was created.

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
