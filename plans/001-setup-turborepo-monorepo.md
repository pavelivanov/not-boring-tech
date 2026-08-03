# Plan 001: Establish the Turborepo monorepo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report; do not improvise. When done, update
> Plan 001's row in `plans/README.md`.
>
> **Drift check (run first)**: `shasum -a 256 business-plan.md`
>
> Expected:
> `1dd1f050e2021a5b05ebfb7797c7fbeb14dc2ad27a51461bd93b004f7dd00da8`.
> The repository has no commits. If the checksum differs, review the live
> product constraints before continuing and stop on a material conflict.

## Status

- **Priority**: P1
- **Effort**: S (approximately one focused day)
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: unborn repository, 2026-07-30

## Why this matters

The website and collector share TypeScript contracts and must be verifiable from
one root command, but they have different runtimes and deployment shapes.
Turborepo plus npm workspaces provides that coordination without coupling the
applications or introducing a second package manager.

This plan creates repository mechanics only. It must not implement product UI,
Telegram access, Hono routes, Prisma models, Docker services, or business logic.

## Current state

- `business-plan.md` is the only product source.
- `plans/` contains implementation handoffs.
- Git is on an unborn `main` branch.
- There is no root package manifest, lockfile, application, test suite, or CI.
- The local environment observed during planning used Node.js 25.6.1 and npm
  11.9.0. The supported project floor is Node.js 22.22.

Relevant product constraints:

- `business-plan.md:86` — keep the project simple enough for one owner.
- `business-plan.md:113-121` — the website prototype precedes the pipeline.
- `business-plan.md:154` — maintenance time is the scarce resource.
- `business-plan.md:189-201` — the eventual system uses one website plus
  controlled ingestion/maintenance tooling.

## Target repository shape

```text
.
├── apps/
│   └── README.md
├── packages/
│   └── typescript-config/
│       ├── package.json
│       ├── base.json
│       ├── react-app.json
│       └── node-service.json
├── plans/
├── .gitignore
├── .npmrc
├── README.md
├── package.json
├── package-lock.json
└── turbo.json
```

Plans 002 and 003 will add `apps/web`, `apps/service`,
`packages/contracts`, and `packages/db`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Runtime | `node --version && npm --version` | Node >=22.22 and npm 11.9.0 |
| Install | `npm install` | exit 0; one root `package-lock.json` |
| Build | `npm run build` | exit 0; Turbo reports no failed tasks |
| Lint | `npm run lint` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm run test` | exit 0 |
| Full gate | `npm run check` | lint, typecheck, test, and build all exit 0 |

Before editing, read current official guidance:

- <https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository>
- <https://turborepo.dev/docs/crafting-your-repository/configuring-tasks>
- <https://docs.npmjs.com/cli/using-npm/workspaces>

## Scope

**In scope**:

- `package.json`
- `package-lock.json`
- `turbo.json`
- `.gitignore`
- `.npmrc`
- `README.md`
- `apps/README.md`
- `packages/typescript-config/**`
- `plans/README.md` (Plan 001 status only)

**Out of scope**:

- `business-plan.md`
- `.idea/**`
- `apps/web/**`
- `apps/service/**`
- `packages/contracts/**`
- `packages/db/**`
- Docker, PostgreSQL, Prisma, Hono, GramJS, Telegram credentials/sessions.
- UI components, fixture data, search logic, and deployment configuration.

## Git workflow

The repository has no commits. Do not create a branch, commit, push, or PR until
the operator establishes initial history. After that, use
`codex/001-turborepo-monorepo`. Suggested commit message:
`chore: establish turborepo monorepo`.

## Required root configuration

Create a private root `package.json` with:

- package name `findthatproject`;
- `packageManager` set to `npm@11.9.0`;
- Node engine `>=22.22.0`;
- workspaces `apps/*` and `packages/*`;
- `turbo` as a root development dependency;
- root scripts that only delegate to Turbo:

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "check": "npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

Do not add root business dependencies. Each workspace owns its runtime and
development dependencies.

Create `turbo.json` with:

- the current schema URL;
- `build` depending on upstream builds and caching `dist/**`,
  `build/**`, and generated outputs;
- persistent, uncached `dev`;
- `lint`, `typecheck`, and `test` tasks delegated to workspaces;
- no remote-cache token or vendor-specific configuration;
- `.env.example` and shared TypeScript configuration as global hash inputs once
  those files exist;
- no secret values or broad `globalEnv` list.

## Steps

### Step 1: Create the workspace root

Create `package.json`, `.npmrc`, `.gitignore`, `apps/README.md`, and the root
`README.md`.

`.npmrc` must use the root lockfile and must not enable unsafe lifecycle
behavior. `.gitignore` must include:

- `node_modules/`, `.turbo/`, `dist/`, `build/`, `coverage/`;
- `.env` and `.env.*`, while allowing `!.env.example`;
- generated Prisma clients;
- Telegram session files and common session suffixes;
- editor/platform noise without deleting the user's existing `.idea/`.

The root README must link to `business-plan.md` and `plans/README.md`, state the
Node/npm prerequisites, and list the root scripts.

**Verify**:

```sh
node --version \
  && npm --version \
  && test -f package.json \
  && test -f .gitignore \
  && test -f apps/README.md
```

Expected: exit 0; versions meet the floor and all files exist.

### Step 2: Add shared TypeScript configuration

Create workspace `@findthatproject/typescript-config` under
`packages/typescript-config`.

- `base.json`: strict TypeScript defaults, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, modern ESM/module resolution, source maps, and
  no emitted JavaScript.
- `react-app.json`: extends base and adds browser/React JSX settings.
- `node-service.json`: extends base and adds Node settings.

Keep framework-specific generated options in each application; shared configs
contain only rules that both future executors can safely inherit.

**Verify**:

```sh
node -e "JSON.parse(require('fs').readFileSync('packages/typescript-config/package.json','utf8'))" \
  && node -e "JSON.parse(require('fs').readFileSync('packages/typescript-config/base.json','utf8'))"
```

Expected: exit 0 and valid JSON.

### Step 3: Configure Turborepo

Create `turbo.json` and ensure root scripts only delegate tasks. Do not put
application commands or shell-specific path logic in root scripts.

Add `README.md` guidance:

- run a task across all workspaces with `npm run <task>`;
- target one workspace with `npm run <task> --workspace=<name>`;
- run development tasks with `npm run dev`;
- the repository has one root lockfile and no nested lockfiles.

**Verify**:

```sh
npm install \
  && test -f package-lock.json \
  && test "$(find . -mindepth 2 -name package-lock.json -not -path './node_modules/*' | wc -l | tr -d ' ')" = "0"
```

Expected: exit 0; exactly one lockfile exists at the repository root.

### Step 4: Establish the root verification baseline

Run every root task. With only the config workspace, Turbo may report that a
task has no matching workspace script; that is acceptable only if the command
exits 0. Do not add fake tests or empty application packages merely to produce
more output.

**Verify**: `npm run check`

Expected: exit 0 with no failed Turbo tasks.

### Step 5: Document the handoff

Update the Plan 001 row in `plans/README.md` to `DONE`. Record the installed
Turbo version and any generated configuration differences in the root README.

**Verify**:

```sh
rg -n "Turborepo|npm run check|apps/\\*|packages/\\*" README.md package.json turbo.json
```

Expected: matches in all three files.

## Test plan

This setup plan has no product tests. Its regression tests are the root command
surface and structural assertions:

- JSON files parse.
- One root lockfile exists.
- Workspaces are declared.
- Turbo delegates build/lint/typecheck/test.
- `npm run check` exits 0.

## Done criteria

- [ ] Node and npm meet the declared versions.
- [ ] Root `package.json` is private and declares both workspace globs.
- [ ] Exactly one root `package-lock.json` exists.
- [ ] Shared strict TypeScript configurations exist.
- [ ] `npm run lint`, `typecheck`, `test`, and `build` exit 0.
- [ ] No product application, backend, database, or credential file was added.
- [ ] Only in-scope paths changed.
- [ ] Plan 001 status is updated.

## STOP conditions

Stop and report if:

- `business-plan.md` drifted materially.
- Node is below 22.22 or npm is not 11.9.0 and changing the machine is required.
- Current Turborepo documentation no longer supports the planned npm workspace
  configuration or `tasks` schema.
- A nested package manager or second lockfile is required.
- The setup requires modifying `.idea/**`, `business-plan.md`, or application
  paths.
- A verification fails twice after focused correction.

## Maintenance notes

- Keep root scripts as Turbo delegators; application logic belongs in
  workspaces.
- Do not cache persistent services, database migrations, or Telegram sync runs.
- Add environment variable names to task hashes only when they change a
  cacheable task's output. Never put secret values in `turbo.json`.
- When adding a workspace, extend the appropriate shared TypeScript config and
  provide `build`, `lint`, `typecheck`, and `test` scripts where meaningful.
