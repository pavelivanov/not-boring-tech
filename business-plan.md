# Business plan — Public web index of Telegram-sourced tech tools

*Working name: FindThatProject (placeholder). Version 0.1 — draft for decision, not for investors.*

---

## 1. Executive summary

A service that continuously reads a curated set of Telegram channels, extracts every mention of a tech tool / project / library / service, deduplicates across channels, and makes the result searchable.

The core insight is not "a directory of cool tools." The core insight is that **the channels have already done the curation, and their archives are unsearchable.** Telegram search is per-channel, keyword-only, and useless for "that thing someone posted a few months ago that converts X to Y." This product turns a stream you already trust into an index you can query.

Primary interface is **search**, not browse. The product has one surface: a **public website**. It is free to use, requires no account or authentication, and has no paid features.

The website is read-only for visitors. Content cannot be created, edited, or deleted through the UI; all updates are performed by the ingestion and maintenance tooling.

**Positioning in one line:** semantic search over the tech channels you already follow, with cross-channel signal ranking.

**Status:** idea stage. This is primarily a personal utility for the owner, with casual use by friends as a secondary benefit.

---

## 2. Problem

| Pain | Who feels it | Current workaround |
|---|---|---|
| "I saw a tool for this somewhere in Telegram, can't find it" | Owner and friends | Scroll, guess keywords, give up, re-Google |
| Same tool posted in 6 channels — no way to see consensus | Same | Vibes |
| No cross-channel view; each channel is a silo | Same | Manually saved messages, chaotic |
| Saved messages become a write-only graveyard | Same | None |
| General web search often returns low-signal directory pages | Same | Product Hunt, HN, luck |

The specific, recurring pain is **retrieval**, not discovery. Discovery is a nice-to-have that the channels already satisfy. Retrieval is broken and nobody has fixed it.

---

## 3. Solution

### Pipeline
1. **Ingest** — MTProto client (Telethon / GramJS) with a user session, per-channel cursor, and an incremental pull twice a day. Support up to 10 channels with roughly 1–3 posts per channel per day. On initial setup, attempt a rate-limited three-month history backfill.
2. **Prefilter** — a simple heuristic (contains a link / repo / package name; not a job post, not an ad) is sufficient at the expected maximum of roughly 30 posts per day.
3. **Extract** — small LLM call → structured record: name, canonical URL, one-line description, free-form tags, language of origin.
4. **Resolve** — canonicalize URLs (strip UTM, resolve redirects, collapse GitHub paths to `owner/repo`), dedupe items on that key, and record every channel mention separately with both the source post's publication time and the time it was collected.
5. **Classify** — embed the description, match against a curated category registry by nearest centroid; unmatched items go to a queue.
6. **Taxonomy loop** — scheduled clustering of the unclassified queue; clusters over ~15 items get an LLM-proposed name for review through the maintenance tooling.

### Two-level labelling (important)
- **Categories** — 10–30, curated, human-approved, slow-moving. For browsing and structure.
- **Tags** — unlimited, LLM-extracted, no approval, messy by design. For faceting and search. An alias table allows merging later without touching items.

This delivers labels "created on the fly" (tags) without taxonomy churn (categories).

### Search
Hybrid from day one: Postgres `tsvector` for exact tool names, pgvector for "thing that does X", blended with reciprocal rank fusion. Default ranking uses **cross-channel mention count**, not recency — this is the one ranking signal no single channel can offer.

### Website
- **Single product surface** — a responsive English-language web app with search, category and tag filters, and one public page per tool with all mentions listed.
- **Open access** — the entire index is available without authentication, accounts, subscriptions, or access restrictions.
- **Free use** — every feature is free; there are no paid tiers, upgrades, or payment flows.
- **Read-only UI** — visitors cannot edit the index through the website. The ingestion and maintenance tooling is the only way to update content.
- **Visible age** — show the original Telegram post date and a relative age such as “Presented 2 months ago.” When a tool has multiple mentions, show the first presentation date on its summary and the date of each source post on its detail page.
- **Crawlable and shareable** — stable public URLs make the index useful for direct sharing and search-engine discovery.

---

## 4. Why now

- MTProto libraries are mature and stable.
- Extraction-grade LLM inference is now cheap enough that per-post processing costs fractions of a cent — this was not true two years ago.
- pgvector removed the need for a separate vector store, so one person can run this on one Postgres.
- The volume of posts across the owner's Telegram channels has grown past what is practical to track manually.

---

## 5. Users and scope

### Primary user — Owner
The product exists first to make the owner's own set of Telegram tech channels searchable. Product decisions should optimize for this workflow rather than for a broad or hypothetical audience.

### Secondary users — Friends
Friends may use the same public website and benefit from the shared index. They do not need accounts, invitations, or special access.

### Other visitors
Because the website is public, other people may find and use it. Their usage is welcome, but audience growth is not a product goal and does not determine what gets built.

**Scope rule:** build what makes the index useful and maintainable for the owner. Keep it public, free, website-only, and simple enough to operate as a personal project.

---

## 6. Existing alternatives

| Alternative | What it does | Why it does not solve this use case |
|---|---|---|
| Product Hunt | Launch-day discovery | No archive search, launch-biased, misses non-launch tools |
| There's An AI For That / Futurepedia / Toolify | Directory of AI tools | SEO farms, low signal, no provenance, AI-only |
| Awesome-* GitHub lists | Curated, static | Manual, stale, no search, no ranking |
| HN + Algolia search | Excellent archive search | Different corpus; misses everything Telegram-native |
| Telegram aggregator channels | Repost interesting finds | Still a stream, still unsearchable — they are the *input*, not the competitor |
| Telegram native search | Keyword, per-chat | The direct thing being replaced |

The goal is not to compete with these products or build a defensible business. The index only needs to be more useful for this particular channel set and retrieval workflow.

---

## 7. Language

The website interface, normalized tool descriptions, categories, and tags are in **English**. Source links still point to the original Telegram posts regardless of their language.

---

## 8. Product roadmap

### Phase 0 — Personal prototype, no pipeline
Manually curate a representative set of items into a plain English-language static page with working search, category and tag filters, and visible presentation dates. Zero backend.

**Purpose:** confirm that the search and result format solve the owner's retrieval problem before building ingestion.

### Phase 1 — Automated foundation
Ingest up to 10 channels twice a day, attempt an initial three-month backfill, prefilter, extract, dedupe, and provide hybrid search on a responsive public website. Categories are seeded by hand (15 or so), and tags are generated automatically. Category approval and other content changes are performed through maintenance tooling, not a website admin UI.

**Explicitly out of scope:** Telegram bot, native or mobile app, auth, accounts, private content, user-selected channels, UI-based content editing, subscriptions, payments, and paid features.

### Phase 2 — Convenience improvements
Improve query quality, category browsing, related-tool discovery, and per-tool pages with full mention history where these changes are useful to the owner or friends. All features remain public and available without an account.

### Phase 3 — Coverage and maintenance
Expand the curated channel set, improve extraction and deduplication, deepen historical coverage where safe, and strengthen site performance and operational reliability.

Phases are a suggested order, not analytics-driven gates. Later work should be added only when it improves the owner's experience or reduces maintenance effort.

---

## 9. Access and operation

The product is a free public resource. There are no paid features, subscriptions, premium tiers, team plans, private corpora, sponsored placements, affiliate monetization, or payment infrastructure.

Operating costs are covered by the project owner. The project continues for as long as it remains personally useful and reasonably easy to maintain.

---

## 10. Cost model

Monthly, at up to 10 channels and roughly 10–30 posts per day:

| Line | Estimate |
|---|---|
| VPS (ingest + app) | $10–20 |
| Postgres + pgvector (same box, or managed) | $0–25 |
| Extraction LLM (up to ~30 calls/day before prefiltering, cheap model) | $1–3 |
| Embeddings | <$1 |
| Domain | $1.25 |
| **Total** | **~$12–50/mo** |

Cost is not a major risk. The scarce resource is the owner's maintenance time. Infrastructure and feature choices should favor simplicity, low upkeep, and predictable costs.

---

## 11. Analytics and quality checks

No product analytics are required. Do not add visitor tracking, engagement events, funnels, retention cohorts, WAU targets, growth dashboards, or analytics-based phase gates.

Quality can be checked directly during normal use:

- Search should return the expected tools for the owner's common queries.
- New channel posts should appear after the next twice-daily sync without manual website editing.
- Duplicate tools should be merged while preserving every source mention.
- Publication and collection timestamps should be stored correctly, with the publication date and relative age visible on the website.
- Broken links, extraction mistakes, and incorrect categories should be fixable through the maintenance tooling.
- Operational logs may record ingestion and processing failures, but should not track visitor behavior.

---

## 12. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Telegram account restriction on the ingest session | High | Dedicated number, conservative rate limits, staged best-effort three-month backfill, and archived raw messages so a ban costs access but not the corpus |
| The project becomes more complex than its personal value warrants | High | Prefer the smallest implementation that solves the owner's retrieval problem |
| Extraction quality — hallucinated tool names, missed items | Medium | Review questionable results during normal use and correct them through maintenance tooling |
| Category drift and taxonomy churn | Medium | Two-level labelling; versioned classification runs with `run_id`, model, and prompt version for diff and rollback |
| Channel authors object to aggregation | Medium | Attribute every item, link back to the original post, and honour removal requests immediately |
| Legal / ToS ambiguity around aggregating public channel content | Medium | Index metadata and short extracted descriptions, never repost full message text; clear takedown path |
| Trivially cloneable | Low | Accept it; defensibility is irrelevant for a personal utility |
| Unauthorized or accidental content changes | Medium | Keep the public website read-only; permit writes only through controlled ingestion and maintenance tooling |
| Owner bandwidth | Medium | Keep phase scopes small; exclude bots, native apps, auth, payments, and UI editing |

---

## 13. Technical summary

- **Ingest:** Telethon or GramJS, user session, per-channel `last_message_id` cursor, scheduled twice daily for up to 10 channels, with a best-effort three-month initial backfill.
- **Store:** single Postgres with pgvector. No Elasticsearch, no separate vector DB.
- **Core tables:** `channels`, `raw_messages`, `items`, `mentions`, `tags`, `tag_aliases`, `item_tags`, `categories`, `item_categories`, `classification_runs`. Each mention stores `published_at` from Telegram and `collected_at` from the ingestion run; a tool's first-presentation date is derived from its earliest mention.
- **Classification:** embedding + centroid matching against the category registry; HDBSCAN over the unclassified queue on a schedule.
- **Search:** hybrid `tsvector` + pgvector, RRF blend, mention-count ranking.
- **Discovery controls:** text search plus category and tag filters.
- **Language:** English UI and normalized metadata.
- **Surface:** one responsive public website. No Telegram bot or native app.
- **Access:** free and unrestricted, with no auth or accounts.
- **Writes:** the website UI is read-only; only ingestion and maintenance tooling can update content.
- **Build approach:** spec-driven with Claude Code, consistent with existing project methodology. The extraction prompt and the eval set are the two highest-leverage artifacts — treat both as versioned specs, not as code comments.

---

## 14. Product decisions

1. **Channels and schedule:** support up to approximately 10 channels, each publishing around 1–3 posts per day. Sync twice a day.
2. **Language:** English.
3. **Initial discovery features:** text search plus category and tag filters.
4. **History and dates:** attempt to backfill three months of channel history. Store both the original post publication time and the collection time, and show how long ago the tool was originally presented.
