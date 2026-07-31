# Plan 002: Build the retrieval website

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report; do not improvise. When done, update
> Plan 002's row in `plans/README.md`.
>
> **Drift check (run first)**: confirm Plan 001 is `DONE`, then run
> `shasum -a 256 business-plan.md`.
>
> Expected:
> `1dd1f050e2021a5b05ebfb7797c7fbeb14dc2ad27a51461bd93b004f7dd00da8`.
> If Git history exists by execution time, also inspect changes since Plan 001
> and reconcile rather than overwriting them.

## Status

- **Priority**: P1
- **Effort**: M (approximately three to five focused days, including curation)
- **Risk**: MEDIUM
- **Depends on**: Plan 001
- **Category**: feature
- **Planned at**: unborn repository, 2026-07-30

### Owner gate decisions — 2026-07-31

- The owner approved the audited 58-subject corpus.
- The owner approved the demonstrated result-card and detail-page information.
- The owner accepted the current 22 deterministic cases as useful behavior
  checks. They remain implementation-authored checks, so the separate gate for
  at least 15 owner-authored remembered-search queries is still open.
- Five genuine cross-channel subjects are still required. The earlier apparent
  matches were removed because the second-channel posts only mentioned the
  parent technology as context.

## Why this matters

The business plan identifies retrieval—not discovery—as the recurring problem
and explicitly requires a static, zero-backend prototype before ingestion
(`business-plan.md:11-17`, `business-plan.md:113-121`). This plan tests whether
search, filters, provenance, dates, and result formatting are useful with a
representative real corpus.

The output is a responsive, public, English-language, read-only website built
with Vite, React, TypeScript, Tailwind CSS, and shadcn/ui. It is backed only by
checked-in curated fixtures. Stable tool URLs are pre-rendered for sharing and
crawling.

## User-visible outcome

A visitor can:

1. Open the site without an account.
2. Search tools by name, purpose, category, or tag.
3. combine the query with one category and multiple tags.
4. See when a tool was first presented and how many distinct channels mentioned
   it.
5. Open a stable tool page and follow every source Telegram post.
6. Clear filters or recover from an empty result without losing context.

A visitor cannot create, edit, delete, sign in, pay, or configure channels.

## Target repository additions

```text
apps/
└── web/
    ├── app/
    │   ├── components/
    │   │   ├── search-controls.tsx
    │   │   ├── tool-card.tsx
    │   │   ├── tool-list.tsx
    │   │   └── relative-date.tsx
    │   ├── data/
    │   │   ├── channels.ts
    │   │   ├── retrieval-eval.ts
    │   │   └── tools.ts
    │   ├── domain/
    │   │   ├── fixtures.test.ts
    │   │   ├── search.test.ts
    │   │   └── search.ts
    │   ├── routes/
    │   │   ├── about.tsx
    │   │   ├── home.tsx
    │   │   └── tool-detail.tsx
    │   ├── root.tsx
    │   ├── routes.ts
    │   └── app.css
    ├── public/
    ├── components.json
    ├── package.json
    ├── react-router.config.ts
    ├── tsconfig.json
    └── vite.config.ts
└── ...
packages/
└── contracts/
    ├── src/
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

Generated filenames may differ slightly if the current official React Router
template changes. Preserve its conventions; do not force this tree by deleting
valid generated framework files.

## Commands you will need

Run current documentation lookup before scaffolding, as required by
`AGENTS.md`. At minimum, verify the current React Router Framework Mode, Vite,
Tailwind Vite integration, and shadcn React Router instructions.

Official starting points:

- <https://ui.shadcn.com/docs/installation/react-router>
- <https://reactrouter.com/how-to/pre-rendering>
- <https://vite.dev/guide/>
- <https://tailwindcss.com/docs/installation/using-vite>

Expected command surface after implementation:

| Purpose    | Command                                      | Expected on success          |
| ---------- | -------------------------------------------- | ---------------------------- |
| Develop    | `npm run dev --workspace=@techdex/web`       | local URL is printed         |
| Unit tests | `npm run test --workspace=@techdex/web`      | all tests pass               |
| Typecheck  | `npm run typecheck --workspace=@techdex/web` | exit 0                       |
| Build      | `npm run build --workspace=@techdex/web`     | pre-rendered output exists   |
| Full gate  | `npm run check`                              | every workspace task exits 0 |

## Scope

**In scope**:

- `apps/web/**`
- `packages/contracts/**`
- Root `package.json`, `package-lock.json`, and `turbo.json` only as required to
  register and verify the new workspaces.
- Root `README.md` for website commands and architecture.
- `plans/README.md` for Plan 002 status only.
- Curated public tool metadata, channel names, and Telegram source URLs.

**Out of scope**:

- `apps/service/**`, `packages/db/**`, PostgreSQL, Prisma, Hono, Docker.
- Telegram authentication, collection, scheduling, or environment variables.
- LLM extraction, semantic/vector search, canonicalization, automated
  deduplication, or classification.
- Authentication, accounts, payments, analytics, admin/editing UI, comments,
  user-selected channels, and private Telegram content.
- Copying full Telegram posts into a public fixture or page.
- Deployment.

## Git workflow

If the repository still has no commit, stop and ask the operator to establish
initial history. Otherwise create `codex/002-retrieval-website`. Suggested
commit message: `feat: build retrieval website prototype`.

Never discard unrelated working-tree changes. If Plan 001 files differ from
their documented state, inspect and preserve intentional changes.

## Data contract

Create `@techdex/contracts` as a framework-neutral TypeScript workspace. Its
public contract must model:

```ts
type Channel = {
  id: string;
  name: string;
  publicUrl: string;
};

type Mention = {
  channelId: string;
  sourceUrl: string;
  publishedAt: string;
  collectedAt: string;
};

type TechnologyKind =
  | "TOOL"
  | "PROJECT"
  | "LIBRARY"
  | "SERVICE"
  | "PRODUCT"
  | "FEATURE"
  | "PLUGIN"
  | "SKILL"
  | "GUIDE"
  | "CHEAT_SHEET"
  | "PODCAST"
  | "OTHER_TECH";

type Tool = {
  slug: string;
  name: string;
  kind: TechnologyKind;
  parentName?: string;
  canonicalUrl: string;
  description: string;
  category: string;
  tags: string[];
  mentions: Mention[];
};

type RetrievalEvalCase = {
  query: string;
  category?: string;
  tags?: string[];
  expectedToolSlugs: string[];
};
```

Use readonly fields/collections where practical. Dates are ISO-8601 UTC strings
at the package boundary. Add runtime validation with a small schema library only
if both fixtures and the later API can share it; do not add a bespoke validation
framework.

The contract must preserve these invariants:

- Tool slugs, canonical URLs, channel IDs, and source URLs are unique where
  appropriate.
- Every mention refers to a known channel.
- Every tool has at least one mention.
- Only feature records have a non-empty `parentName`. A parent may link to
  another corpus record, but parent existence is not required for indexing a
  feature.
- Mentions belong to the primary subject actually presented by the post. A
  related project, plugin, skill, guide, cheat sheet, or feature must not
  silently donate its provenance to a named parent tool.
- A tool's first-presentation date is derived from its earliest
  `publishedAt`; it is not hand-maintained as a second source of truth.
- Distinct-channel count is derived from unique mention channel IDs.
- `collectedAt` is retained in the model but is not presented as the original
  publication date.

Do not place React components, Prisma types, database IDs, or framework request
objects in `@techdex/contracts`.

## Fixture and evaluation requirements

Curate metadata for at least 40 real technology subjects from the owner's
intended public Telegram-channel corpus:

- At least five categories.
- At least 20 distinct tags.
- At least five tools mentioned by two or more distinct channels.
- Valid canonical tool URLs and valid public source-post URLs.
- Short original English descriptions; do not reproduce full channel posts.
- Publication dates from the source posts and a realistic `collectedAt`.
- Explicit attribution through the channel and source link.

Create at least 15 owner-written retrieval cases based on remembered needs, not
queries reverse-engineered from the fixture descriptions. An expected tool must
rank in the top five for at least 12 of 15 cases.

The owner supplies or approves the public channel set and the final expected
tools. If no representative public corpus is available, use clearly marked
temporary sample records only to build the interface, but Plan 002 cannot be
marked `DONE` and Plan 003 cannot start.

## Deterministic prototype search

Implement search as a pure function over fixtures. Normalize case, Unicode, and
repeated whitespace. Do not add network calls or claim semantic search.

Use these rules:

1. The text query, selected category, and selected tags combine with AND.
2. The category filter permits zero or one category.
3. Selected tags use OR within the tag facet: a tool matching any selected tag
   remains eligible.
4. An empty query returns all filter-eligible tools.
5. Match relevance in this order:
   - exact normalized tool name;
   - name prefix or complete name token;
   - tag;
   - category;
   - description token.
6. Tie-break by distinct-channel count descending, then tool name ascending.
7. With no text query, sort by distinct-channel count descending, then name.

Weights may be represented as constants, but tests must assert ordering rather
than internal score values. Avoid fuzzy-search dependencies until the owner has
shown that deterministic matching is insufficient.

URL search parameters are the state boundary:

- `q` for the text query;
- `category` for the single category;
- repeated `tag` values for tags.

Opening, refreshing, sharing, and using browser back/forward must preserve the
same result set. Invalid category/tag values are ignored and removed on the next
state update rather than causing an error.

## Information architecture and UI

### Home route

- A concise heading explaining that this is a search index of tools mentioned
  by trusted Telegram channels.
- One primary search control.
- A category selector.
- A searchable tag picker.
- A result count and active-filter summary.
- A single vertical result list; avoid a dashboard/card-grid aesthetic.
- A useful empty state with a one-action “Clear filters” control.

Each result must show:

- Tool name linked to its stable detail route.
- One-line English description.
- Category and a restrained subset of tags.
- “Presented … ago” based on the earliest source publication.
- Distinct-channel mention count.
- Canonical tool URL and a clear provenance affordance.

### Tool detail route

- Stable path `/tools/:slug`.
- Name, description, canonical URL, category, tags, and first-presentation date.
- Every mention ordered by `publishedAt`, newest first.
- Channel name, absolute publication date, relative age, and direct Telegram
  source URL for each mention.
- A link back to the current search when navigation originated from results.
- A real not-found state for an unknown slug.

### About route

Explain the corpus boundary, source attribution, read-only nature, and how to
request correction/removal. Do not add a contact form unless a real handling
destination exists.

### shadcn/ui use

Initialize shadcn for the React Router template and inspect generated project
information:

```sh
mkdir -p apps
npx shadcn@latest init \
  --name web \
  --template react-router \
  --preset radix-nova \
  --no-monorepo \
  --yes \
  --cwd apps
npx shadcn@latest info --cwd apps/web
```

If the current CLI syntax differs, follow current official documentation and
record the difference in the root README. Do not create a nested lockfile.

Read component docs before adding them, then install only the primitives the
interface uses:

```sh
npx shadcn@latest add \
  input-group button select popover command badge empty separator field \
  --cwd apps/web
```

Use semantic theme tokens in `app.css`; do not hard-code arbitrary colors into
each component. Keep the visual hierarchy search-led, restrained, and readable.
Icons need accessible names where they are the only control label.

## Rendering and crawlability

Use React Router Framework Mode on Vite. Configure:

- client rendering with `ssr: false`;
- pre-rendering for `/`, `/about`, and every `/tools/:slug`;
- a deterministic list of tool-detail paths derived from the fixture slugs;
- unique page titles and descriptions for home, about, and tool pages;
- a canonical URL helper that can accept a future deployment origin without
  hard-coding localhost.

The build must fail if a fixture slug collides or a pre-render target has no
matching tool.

Relative time is inherently time-dependent. Render it from a stable reference
or update it after hydration without changing the server/pre-rendered element
shape. The absolute date must always be available in visible text or an
accessible label.

## Steps

### Step 1: Verify the foundation and documentation

Confirm Plan 001 is complete, the root workspace is clean enough to edit, and
the current framework documentation still supports the planned configuration.

**Verify**:

```sh
test -f package.json \
  && test -f turbo.json \
  && test -f packages/typescript-config/react-app.json \
  && rg -n "002.*TODO|002.*IN PROGRESS" plans/README.md
```

Expected: exit 0.

### Step 2: Scaffold the application and contracts

Run the shadcn React Router scaffold, remove any nested lockfile, rename the
workspace package to `@techdex/web`, and make its TypeScript config extend the
shared React config without breaking framework-generated references.

Create `@techdex/contracts`, export its types/schemas, and add it as a workspace
dependency of the web app. Install from the repository root so only the root
lockfile changes.

Add workspace scripts for `dev`, `build`, `lint`, `typecheck`, and `test`.

**Verify**:

```sh
npm install \
  && npm ls @techdex/web @techdex/contracts \
  && test "$(find apps packages -name package-lock.json | wc -l | tr -d ' ')" = "0"
```

Expected: both workspaces resolve and no nested lockfile exists.

### Step 3: Add validated representative fixtures

Create channel, tool, and retrieval-evaluation modules. Add invariant tests
before UI code so bad slugs, references, dates, or duplicate URLs fail loudly.

Do not include Telegram session data, private links, copied full posts, or
personal notes.

**Verify**:

```sh
npm run test --workspace=@techdex/web -- --run
```

Expected: fixture-invariant tests pass and report at least 40 tools, five
categories, 20 tags, five cross-channel tools, and 15 evaluation cases.

### Step 4: Implement and evaluate deterministic retrieval

Implement the pure search/filter/sort function and unit tests covering exact
names, partial names, description terms, category, multiple tags, combined
filters, empty queries, stable tie-breaking, and Unicode/case normalization.

Add a test that computes the top-five evaluation pass rate and prints failures
with query and expected slugs. Tune only documented ranking constants; do not
edit fixture descriptions merely to make the test pass.

**Verify**:

```sh
npm run test --workspace=@techdex/web -- --run
```

Expected: at least 12 of 15 evaluation cases pass at top five.

### Step 5: Build routes and interface

Build home, tool detail, about, and not-found experiences from the shared
contract. Implement URL-backed state and accessible controls with the selected
shadcn primitives.

Ensure links are ordinary crawlable anchors and every external link is visibly
distinguishable. When opening a new tab, use safe `rel` attributes.

**Verify**:

```sh
npm run lint --workspace=@techdex/web \
  && npm run typecheck --workspace=@techdex/web \
  && npm run test --workspace=@techdex/web -- --run
```

Expected: exit 0 with no ignored type or lint failures.

### Step 6: Configure pre-rendering and metadata

Pre-render the stable routes, emit per-route metadata, and verify the generated
client output contains representative home, about, and tool pages.

**Verify**:

```sh
npm run build --workspace=@techdex/web \
  && test -d apps/web/build/client \
  && find apps/web/build/client -type f | sort | sed -n '1,80p'
```

Expected: build exits 0 and generated assets/pages are listed. Adjust the output
path only if the current official template intentionally uses a different one.

### Step 7: Browser quality pass

Run the production build locally and inspect at mobile and desktop widths.
Exercise:

- query typing, category selection, multiple tags, and clear-all;
- shared URL reload and browser back/forward;
- zero-result recovery;
- opening a tool detail page directly;
- an unknown tool slug;
- keyboard-only search/filter/detail navigation;
- focus visibility and accessible names;
- long tool names, descriptions, tags, and channel names;
- no hydration warnings or console errors.

The owner reviews at least the common query cases and the information shown on a
result and detail page.

**Verify**: save no screenshots or browser artifacts to the repository unless
they are deliberately added to documentation.

### Step 8: Run the repository gate and hand off

Update the root README with application commands and the fixture-only boundary.
Run the full gate, then update Plan 002 to `DONE` only after owner approval.

**Verify**: `npm run check`

Expected: exit 0 across every workspace.

## Test plan

### Unit

- Fixture referential integrity and uniqueness.
- Derived first-presentation date and distinct-channel count.
- Search normalization, eligibility, scoring order, and stable tie-breaks.
- Query-parameter parse/serialize round trips.
- Relative and absolute date formatting.
- Retrieval evaluation threshold.

### Route/component

- Home renders the unfiltered corpus.
- Filters update both results and URL.
- Empty results retain the active query and expose clear-all.
- Tool detail lists every source mention.
- Unknown slug renders not found.
- External links use the expected URL and safe relationship.

### Manual browser

- 320 px mobile width, common tablet width, and wide desktop.
- Keyboard-only and visible-focus flow.
- Refresh/back/forward state preservation.
- Direct pre-rendered route load.
- Console and hydration cleanliness.

## Done criteria

- [x] Plan 001 is `DONE`.
- [x] `@techdex/web` and `@techdex/contracts` are npm workspaces with no nested
      lockfile.
- [x] The UI uses Vite, React, TypeScript, Tailwind CSS, and shadcn/ui.
- [ ] At least 40 real, attributed tools meet all fixture coverage rules.
- [ ] At least five subjects have genuine mentions from two or more distinct
      approved channels.
- [ ] At least 12 of 15 owner-written queries pass at top five.
- [x] Search, category, and tag state survives refresh and sharing.
- [x] Home, about, and every known tool page are pre-rendered.
- [x] Publication date, relative age, and all source mentions are visible.
- [x] The website remains public, read-only, English, and free of analytics/auth.
- [x] Browser quality pass and owner information-design review are complete.
- [x] `npm run check` exits 0.
- [ ] Only in-scope paths changed.
- [ ] Plan 002 status is updated.

## STOP conditions

Stop and report if:

- Plan 001 is not `DONE` or its verification baseline is broken.
- `business-plan.md` drifted materially.
- The owner cannot provide/approve a representative public corpus; temporary
  data may support UI work, but the plan cannot finish.
- Current React Router or shadcn documentation no longer supports a Vite-based
  Framework Mode build with stable pre-render targets.
- Meeting the gate appears to require semantic search, a backend, copied full
  posts, or fabricated source data.
- A requirement would add auth, analytics, write UI, private content, or another
  product surface.
- A verification fails twice after focused correction.

## Maintenance notes

- Curated fixtures are a prototype data source, not the future database export.
- Keep retrieval logic pure so the later API integration can compare server
  ranking against the approved prototype behavior.
- Treat result-card and tool-detail fields as the public read contract. The
  backend may add fields later, but must not silently remove provenance or date
  semantics.
- Keep generated shadcn components local to the web app. Share domain contracts,
  not presentation components, with the service.
