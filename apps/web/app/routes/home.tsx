import type {
  CatalogListItem,
  TechnologyKind,
} from "@findthatproject/contracts"
import { AlertCircleIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Link,
  useLocation,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router"

import type { Route } from "./+types/home"
import { IndexSearchDialog } from "~/components/search-controls"
import { TelegramIcon } from "~/components/telegram-icon"
import { ToolList, type LedgerEmptyState } from "~/components/tool-list"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import {
  CatalogApiError,
  loadHomeCatalog,
  loadNextCatalogPage,
  type HomeCatalogData,
} from "~/data/api-client"
import { digestChannels } from "~/domain/channels"
import {
  filtersFromActive,
  serializeSearchParams,
  type SearchFilters,
} from "~/domain/search"
import {
  formatTechnologyKind,
  formatTechnologyKindPlural,
} from "~/domain/tools"
import { canonicalMeta } from "~/domain/urls"

export function meta() {
  return [
    { title: "FindThatProject · Catch up or find it again" },
    {
      name: "description",
      content:
        "Catch up on newly indexed technology, then search the full cross-channel index when you need to find it again.",
    },
    ...canonicalMeta("/"),
  ]
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  return loadHomeCatalog(request.url, request.signal)
}
clientLoader.hydrate = true as const

type StoredReadState = {
  readonly seen: readonly string[]
  readonly seenThrough: string | null
  readonly lastVisit: string | null
}

type LedgerSort = "traction" | "newest"

const readStateStorageKey = "findthatproject:read-state:v1"

const kindOrder: readonly TechnologyKind[] = [
  "PROJECT",
  "TOOL",
  "LIBRARY",
  "SERVICE",
  "PRODUCT",
  "FEATURE",
  "PLUGIN",
  "SKILL",
  "GUIDE",
  "CHEAT_SHEET",
  "PODCAST",
  "OTHER_TECH",
]

const visitDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
})

function readStoredState(): StoredReadState {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(readStateStorageKey) ?? "null"
    )

    if (!value || typeof value !== "object") {
      return { seen: [], seenThrough: null, lastVisit: null }
    }

    const record = value as Record<string, unknown>
    const validDate = (entry: unknown) =>
      typeof entry === "string" && !Number.isNaN(Date.parse(entry))
        ? entry
        : null
    return {
      seen: Array.isArray(record.seen)
        ? record.seen.filter(
            (entry): entry is string => typeof entry === "string"
          )
        : [],
      seenThrough: validDate(record.seenThrough),
      lastVisit: validDate(record.lastVisit),
    }
  } catch {
    return { seen: [], seenThrough: null, lastVisit: null }
  }
}

function compareTraction(
  left: CatalogListItem,
  right: CatalogListItem
): number {
  return (
    (right.githubStars ?? -1) - (left.githubStars ?? -1) ||
    right.mentionCount - left.mentionCount ||
    Date.parse(right.firstMentionedAt) - Date.parse(left.firstMentionedAt)
  )
}

function compareNewest(left: CatalogListItem, right: CatalogListItem): number {
  return (
    Date.parse(right.firstMentionedAt) - Date.parse(left.firstMentionedAt) ||
    compareTraction(left, right)
  )
}

function CatalogSurface({ data }: { readonly data: HomeCatalogData }) {
  const [, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigation = useNavigation()
  const [sort, setSort] = useState<LedgerSort>("traction")
  const [onlyUnseen, setOnlyUnseen] = useState(false)
  const [seenSlugs, setSeenSlugs] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [seenThrough, setSeenThrough] = useState<string | null>(null)
  const [previousVisit, setPreviousVisit] = useState<string | null>(null)
  const [readStateRestored, setReadStateRestored] = useState(false)
  const [items, setItems] = useState<readonly CatalogListItem[]>(
    () => data.catalog.items
  )
  const [knownEntries, setKnownEntries] = useState<
    ReadonlyMap<string, CatalogListItem>
  >(() => new Map(data.catalog.items.map((item) => [item.slug, item])))
  const [nextCursor, setNextCursor] = useState(data.catalog.nextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreFailed, setLoadMoreFailed] = useState(false)
  const activeRequest = useRef<AbortController | null>(null)
  const currentVisit = useRef("")
  const filters = filtersFromActive(data.catalog.filters)
  const totalCount = data.facets.categories.reduce(
    (total, facet) => total + facet.count,
    0
  )
  const kindOptions = [...data.facets.kinds].sort(
    (left, right) =>
      kindOrder.indexOf(left.value) - kindOrder.indexOf(right.value)
  )
  const digestLinks = digestChannels()
  const isFiltering =
    navigation.state === "loading" &&
    navigation.location?.pathname === location.pathname &&
    navigation.location.search !== location.search

  useEffect(() => {
    const stored = readStoredState()
    currentVisit.current = new Date().toISOString()
    setSeenSlugs(new Set(stored.seen))
    setSeenThrough(stored.seenThrough)
    setPreviousVisit(stored.lastVisit)
    setReadStateRestored(true)
  }, [])

  useEffect(() => {
    if (!readStateRestored) return

    try {
      window.localStorage.setItem(
        readStateStorageKey,
        JSON.stringify({
          seen: [...seenSlugs],
          seenThrough,
          lastVisit: currentVisit.current,
        } satisfies StoredReadState)
      )
    } catch {
      // The ledger remains useful for the active session without storage.
    }
  }, [readStateRestored, seenSlugs, seenThrough])

  useEffect(
    () => () => {
      activeRequest.current?.abort()
    },
    []
  )

  useEffect(() => {
    activeRequest.current?.abort()
    setItems(data.catalog.items)
    setNextCursor(data.catalog.nextCursor)
    setLoadingMore(false)
    setLoadMoreFailed(false)
  }, [data.catalog])

  useEffect(() => {
    setKnownEntries((current) => {
      const next = new Map(current)
      for (const item of items) next.set(item.slug, item)
      return next.size === current.size ? current : next
    })
  }, [items])

  const updateFilters = useCallback(
    (next: SearchFilters, replace = false) => {
      setSearchParams(serializeSearchParams(next), { replace })
    },
    [setSearchParams]
  )

  const isUnseen = useCallback(
    (item: CatalogListItem) =>
      !seenSlugs.has(item.slug) &&
      (!seenThrough ||
        Date.parse(item.firstMentionedAt) > Date.parse(seenThrough)),
    [seenSlugs, seenThrough]
  )

  const unseenSlugs = useMemo(
    () => new Set(items.filter(isUnseen).map((item) => item.slug)),
    [isUnseen, items]
  )

  // The banner counter answers "what landed while I was away", so it spans every
  // entry this session has loaded rather than the currently filtered page.
  const unseenEntries = useMemo(
    () => [...knownEntries.values()].filter(isUnseen).toSorted(compareNewest),
    [isUnseen, knownEntries]
  )

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => !onlyUnseen || unseenSlugs.has(item.slug))
        .toSorted(sort === "newest" ? compareNewest : compareTraction),
    [items, onlyUnseen, sort, unseenSlugs]
  )

  const markSeen = useCallback((slug: string) => {
    setSeenSlugs((current) => {
      if (current.has(slug)) return current
      const next = new Set(current)
      next.add(slug)
      return next
    })
  }, [])

  function markAllSeen() {
    setSeenSlugs((current) => new Set([...current, ...knownEntries.keys()]))
    setSeenThrough(new Date().toISOString())
  }

  function resetReadState() {
    setSeenSlugs(new Set())
    setSeenThrough(null)
  }

  function clearFilters() {
    updateFilters({ query: "", tags: [], sort: filters.sort })
  }

  function changeKind(kind?: TechnologyKind) {
    const { kind: _kind, ...remainingFilters } = filters
    updateFilters(
      kind && kind !== filters.kind
        ? { ...remainingFilters, kind }
        : remainingFilters
    )
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoadingMore(true)
    setLoadMoreFailed(false)

    try {
      const page = await loadNextCatalogPage(
        data.catalog.filters,
        nextCursor,
        controller.signal
      )
      setItems((current) => [...current, ...page.items])
      setNextCursor(page.nextCursor)
    } catch {
      if (!controller.signal.aborted) setLoadMoreFailed(true)
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false)
    }
  }

  const lastVisitDate = previousVisit
    ? visitDateFormatter.format(new Date(previousVisit))
    : null
  const query = filters.query.trim()
  const kindLabel = filters.kind ? formatTechnologyKind(filters.kind) : null
  const shownCount = visibleItems.length
  const unseenCount = unseenEntries.length
  const unseenInView = items.filter((item) => unseenSlugs.has(item.slug)).length
  const scopeCount = filters.kind
    ? (kindOptions.find((option) => option.value === filters.kind)?.count ??
      shownCount)
    : totalCount

  function bannerLine(): string {
    if (unseenCount === 0) {
      return lastVisitDate
        ? `You are up to date — nothing new since ${lastVisitDate}.`
        : "You are up to date."
    }

    const entryWord = unseenCount === 1 ? "entry" : "entries"

    if (!lastVisitDate) {
      return `${unseenCount} ${entryWord} indexed so far — all new on your first visit`
    }

    if (kindLabel) {
      return `${unseenCount} new since ${lastVisitDate} · ${unseenInView} in ${formatTechnologyKindPlural(
        filters.kind as TechnologyKind
      )}`
    }

    return `${unseenCount} ${entryWord} indexed since your last visit on ${lastVisitDate}`
  }

  function scopeLine() {
    if (isFiltering) return "Updating entries…"

    const total = onlyUnseen ? unseenInView : scopeCount
    const counts = ` · Showing ${shownCount} of ${total}`

    // The scope line is set in uppercase mono, so the searched term keeps its
    // own casing to stay recognisable as what was typed.
    return query ? (
      <>
        Search <span className="ledger-scope-term">“{query}”</span>
        {counts}
      </>
    ) : (
      `${kindLabel ?? "All"}${counts}`
    )
  }

  function resolveEmptyState(): LedgerEmptyState {
    if (totalCount === 0) {
      return {
        title: "No parsed entries yet",
        body: "The index will populate after the configured public channels complete a parser run.",
      }
    }

    if (query) {
      if (onlyUnseen && items.length > 0) {
        return {
          title: `Nothing new matches “${query}”`,
          body:
            items.length === 1
              ? "One entry in the index matches, indexed before your last visit."
              : `${items.length} entries in the index match, all indexed before your last visit.`,
          actionLabel: "Search the whole index",
          onAction: () => setOnlyUnseen(false),
        }
      }

      return {
        title: `No entry matches “${query}”`,
        body: kindLabel
          ? `Nothing under ${kindLabel}. Widening the type filter may help.`
          : "Try a shorter word, or the name of the tool it is built on.",
        actionLabel: kindLabel ? "Clear search and filter" : "Clear search",
        onAction: clearFilters,
      }
    }

    if (onlyUnseen) {
      if (kindLabel) {
        return {
          title: `Nothing new under ${kindLabel}`,
          body: "Other types picked up entries since your last visit.",
          actionLabel: "All new entries",
          onAction: () => changeKind(),
        }
      }

      return {
        title: "You have read everything new.",
        body: "A few entries land every day. The banner up top will be holding them next time you drop in.",
        actionLabel: "Back to the index",
        onAction: () => setOnlyUnseen(false),
      }
    }

    if (kindLabel) {
      return {
        title: `Nothing indexed under ${kindLabel} yet`,
        body: "This type is tracked but still empty.",
        actionLabel: "Show all types",
        onAction: () => changeKind(),
      }
    }

    return {
      title: "No entries match this combination",
      body: "Try a shorter search, another type, or clear the current filters.",
      actionLabel: "Clear filters",
      onAction: clearFilters,
    }
  }

  return (
    <div className="index-page">
      <header className="index-header">
        <div className="index-brand-block">
          <Link
            to="/"
            className="index-brand"
            aria-label="FindThatProject home"
          >
            FindThatProject<span>/</span>
          </Link>
          <p className="index-tagline">
            Hand-indexed tools, projects &amp; podcasts
          </p>
        </div>

        <div className="index-header-tools">
          <IndexSearchDialog
            entries={[...knownEntries.values()]}
            suggestions={unseenEntries}
            query={filters.query}
            search={location.search}
            onSubmitQuery={(next) => updateFilters({ ...filters, query: next })}
            onOpenEntry={markSeen}
          />

          {digestLinks.length > 0 ? (
            <>
              <span className="index-header-divider" aria-hidden="true" />
              <div className="index-digest">
                <span>Weekly digest</span>
                {digestLinks.map((channel) => (
                  <a
                    key={channel.handle}
                    href={channel.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${channel.locale} weekly digest on Telegram (opens in a new tab)`}
                  >
                    <TelegramIcon />
                    {channel.locale}
                  </a>
                ))}
              </div>
            </>
          ) : null}

          <span className="index-header-divider" aria-hidden="true" />
          <nav className="index-utility-nav" aria-label="Site links">
            <Link to="/about">About</Link>
          </nav>
        </div>
      </header>

      <div className="index-body">
        <aside className="index-sidebar" aria-label="Index filters">
          <div className="index-facet">
            <h2 className="index-facet-title">Type</h2>
            <nav className="index-facet-list">
              <button
                type="button"
                className="index-facet-option"
                aria-pressed={!filters.kind}
                onClick={() => changeKind()}
              >
                <span>All</span>
                <span>{totalCount}</span>
              </button>
              {kindOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="index-facet-option"
                  aria-pressed={filters.kind === option.value}
                  onClick={() => changeKind(option.value)}
                >
                  <span>{formatTechnologyKind(option.value)}</span>
                  <span>{option.count}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="index-facet index-facet-sort">
            <h2 className="index-facet-title">Sort</h2>
            <div className="index-facet-list">
              <button
                type="button"
                className="index-facet-option"
                aria-pressed={sort === "traction"}
                onClick={() => setSort("traction")}
              >
                <span>Traction</span>
              </button>
              <button
                type="button"
                className="index-facet-option"
                aria-pressed={sort === "newest"}
                onClick={() => setSort("newest")}
              >
                <span>Newest</span>
              </button>
            </div>
          </div>
        </aside>

        <main id="main-content" tabIndex={-1} className="index-main">
          <h1 className="sr-only">FindThatProject technology ledger</h1>

          <section
            className="ledger-banner"
            data-quiet={unseenCount === 0 || undefined}
            aria-live="polite"
          >
            <p className="ledger-banner-line">
              <span className="ledger-banner-dot" aria-hidden="true" />
              {bannerLine()}
            </p>

            <div className="ledger-banner-actions">
              {unseenCount > 0 ? (
                <button
                  type="button"
                  className="ledger-banner-quiet-action"
                  onClick={markAllSeen}
                >
                  Mark all seen
                </button>
              ) : (
                <button
                  type="button"
                  className="ledger-banner-quiet-action"
                  onClick={resetReadState}
                >
                  Reset read state
                </button>
              )}
              <button
                type="button"
                className="ledger-banner-toggle"
                aria-pressed={onlyUnseen}
                onClick={() => setOnlyUnseen((current) => !current)}
              >
                {onlyUnseen ? "Showing new only" : "Show only new"}
              </button>
            </div>
          </section>

          <div className="ledger-scope">
            <p aria-live="polite">{scopeLine()}</p>
            <p>{sort === "newest" ? "Newest first" : "Sorted by traction"}</p>
          </div>

          <div className="index-surface" aria-busy={isFiltering}>
            <ToolList
              tools={visibleItems}
              search={location.search}
              unseenSlugs={unseenSlugs}
              onMarkSeen={markSeen}
              emptyState={resolveEmptyState()}
            />

            {loadMoreFailed ? (
              <Alert className="catalog-inline-alert" variant="destructive">
                <AlertCircleIcon aria-hidden="true" />
                <AlertTitle>More entries could not be loaded</AlertTitle>
                <AlertDescription>
                  The entries already shown are still available. Retry when the
                  API is reachable.
                </AlertDescription>
                <AlertAction>
                  <Button variant="outline" size="sm" onClick={loadMore}>
                    Retry
                  </Button>
                </AlertAction>
              </Alert>
            ) : null}

            {nextCursor ? (
              <div className="catalog-load-more">
                <button
                  type="button"
                  className="ledger-load-more"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore ? "Loading more…" : "Load more entries"}
                </button>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <footer className="index-footer">
        <p>
          Every new entry is announced on{" "}
          <a
            href="https://t.me/findthatproject"
            target="_blank"
            rel="noreferrer"
          >
            @findthatproject
          </a>
          . Miss the posts and the banner up top has them waiting.
        </p>
        <span>
          {totalCount} indexed · {data.facets.kinds.length} types
        </span>
      </footer>
    </div>
  )
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <CatalogSurface data={loaderData} />
}

export function HydrateFallback() {
  return (
    <div className="index-page" aria-label="Loading catalog">
      <header className="index-header">
        <div className="index-brand-block">
          <span className="index-brand" aria-hidden="true">
            FindThatProject<span>/</span>
          </span>
          <p className="index-tagline">
            Hand-indexed tools, projects &amp; podcasts
          </p>
        </div>
        <Skeleton className="h-8 w-40" />
      </header>
      <div className="index-body">
        <aside className="index-sidebar">
          <Skeleton className="h-64 w-full" />
        </aside>
        <main id="main-content" className="index-main">
          <Skeleton className="h-12 w-full" />
          <div className="ledger-loading-list">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const revalidator = useRevalidator()
  const requestId = error instanceof CatalogApiError ? error.requestId : null

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="page-width flex min-h-[65svh] items-center py-16"
    >
      <Alert variant="destructive" className="max-w-2xl">
        <AlertCircleIcon aria-hidden="true" />
        <AlertTitle>The catalog API is unavailable</AlertTitle>
        <AlertDescription>
          FindThatProject will not substitute sample entries. Retry the live
          catalog request.
          {requestId ? ` Request ID: ${requestId}.` : ""}
        </AlertDescription>
        <AlertAction>
          <Button
            variant="outline"
            disabled={revalidator.state !== "idle"}
            onClick={() => revalidator.revalidate()}
          >
            {revalidator.state === "idle" ? "Retry" : "Retrying…"}
          </Button>
        </AlertAction>
      </Alert>
    </main>
  )
}
