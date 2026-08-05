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
import { IndexSearch } from "~/components/search-controls"
import { ToolList } from "~/components/tool-list"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import {
  CatalogApiError,
  loadHomeCatalog,
  loadNextCatalogPage,
  type HomeCatalogData,
} from "~/data/api-client"
import {
  filtersFromActive,
  serializeSearchParams,
  type SearchFilters,
} from "~/domain/search"
import { formatTechnologyKind } from "~/domain/tools"
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

type CatalogMode = "unseen" | "index"

type StoredReadState = {
  readonly seen: readonly string[]
  readonly seenThrough: string | null
  readonly lastVisit: string | null
}

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
  month: "short",
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

function CatalogSurface({ data }: { readonly data: HomeCatalogData }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigation = useNavigation()
  const [mode, setMode] = useState<CatalogMode>("unseen")
  const [seenSlugs, setSeenSlugs] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [seenThrough, setSeenThrough] = useState<string | null>(null)
  const [previousVisit, setPreviousVisit] = useState<string | null>(null)
  const [readStateRestored, setReadStateRestored] = useState(false)
  const [items, setItems] = useState<readonly CatalogListItem[]>(
    () => data.catalog.items
  )
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

  const updateFilters = useCallback(
    (next: SearchFilters, replace = false) => {
      setSearchParams(serializeSearchParams(next), { replace })
    },
    [setSearchParams]
  )

  const unseenSlugs = useMemo(
    () =>
      new Set(
        items
          .filter(
            (item) =>
              !seenSlugs.has(item.slug) &&
              (!seenThrough ||
                Date.parse(item.firstMentionedAt) > Date.parse(seenThrough))
          )
          .map((item) => item.slug)
      ),
    [items, seenSlugs, seenThrough]
  )

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => mode === "index" || unseenSlugs.has(item.slug))
        .toSorted(compareTraction),
    [items, mode, unseenSlugs]
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
    setSeenSlugs(
      (current) => new Set([...current, ...items.map(({ slug }) => slug)])
    )
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

  const lastVisitLabel = previousVisit
    ? visitDateFormatter.format(new Date(previousVisit))
    : "First visit"
  const emptyState =
    totalCount === 0
      ? "database"
      : mode === "unseen" && items.length > 0
        ? "caught-up"
        : "filtered"

  return (
    <div className="catalog-page">
      <div className="catalog-frame">
        <header className="catalog-header">
          <Link
            to="/"
            className="catalog-brand"
            aria-label="FindThatProject home"
          >
            FindThatProject<span>/</span>
          </Link>

          <IndexSearch
            filters={filters}
            enableShortcut
            onChange={updateFilters}
          />

          <nav className="catalog-utility-nav" aria-label="Site links">
            <a
              href="https://t.me/findthatproject"
              target="_blank"
              rel="noreferrer"
            >
              @findthatproject
            </a>
            <Link to="/about">About</Link>
          </nav>
        </header>

        <main id="main-content" tabIndex={-1} className="index-main">
          <h1 className="sr-only">FindThatProject technology ledger</h1>

          <section className="ledger-overview" aria-labelledby="queue-heading">
            <div className="ledger-overview-copy">
              <p>Since you were last here · {lastVisitLabel}</p>
              <div>
                <strong>{unseenSlugs.size}</strong>
                <h2 id="queue-heading">unseen entries</h2>
              </div>
            </div>

            <div className="ledger-overview-actions">
              <Button variant="ink" size="pill" onClick={markAllSeen}>
                Mark all seen
              </Button>
              <Button variant="outline" size="pill" onClick={resetReadState}>
                Reset
              </Button>
            </div>
          </section>

          <section className="ledger-controls" aria-label="Catalog view">
            <ToggleGroup
              type="single"
              value={mode}
              className="ledger-mode-switch"
              aria-label="Catalog mode"
              onValueChange={(value) => {
                if (value === "unseen" || value === "index") setMode(value)
              }}
            >
              <ToggleGroupItem value="unseen">Unseen</ToggleGroupItem>
              <ToggleGroupItem value="index">Index</ToggleGroupItem>
            </ToggleGroup>

            <div className="ledger-kind-filters" aria-label="Filter by type">
              <Button
                variant={filters.kind ? "outline" : "ink"}
                size="sm"
                className="ledger-kind-chip"
                aria-pressed={!filters.kind}
                onClick={() => changeKind()}
              >
                All <span>{totalCount}</span>
              </Button>
              {kindOptions.map((option) => {
                const active = filters.kind === option.value
                return (
                  <Button
                    key={option.value}
                    variant={active ? "ink" : "outline"}
                    size="sm"
                    className="ledger-kind-chip"
                    aria-pressed={active}
                    onClick={() => changeKind(option.value)}
                  >
                    {formatTechnologyKind(option.value)}
                    <span>{option.count}</span>
                  </Button>
                )
              })}
            </div>

            <p className="ledger-showing" aria-live="polite">
              {isFiltering
                ? "Updating entries…"
                : `Showing ${visibleItems.length} of ${totalCount}`}
            </p>
          </section>

          <div className="index-surface" aria-busy={isFiltering}>
            <ToolList
              tools={visibleItems}
              search={location.search}
              unseenSlugs={unseenSlugs}
              onMarkSeen={markSeen}
              onClear={clearFilters}
              onBrowseIndex={() => setMode("index")}
              emptyState={emptyState}
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
                <Button
                  variant="outline"
                  size="pill"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore ? "Loading more…" : "Load more entries"}
                </Button>
              </div>
            ) : null}
          </div>
        </main>

        <footer className="catalog-footer">
          <p>
            Every new entry is announced in the aggregator channel{" "}
            <a
              href="https://t.me/findthatproject"
              target="_blank"
              rel="noreferrer"
            >
              @findthatproject
            </a>{" "}
            — the site is where you catch up on all of them at once.
          </p>
          <span>
            {totalCount} indexed · {data.facets.kinds.length} types
          </span>
        </footer>
      </div>
    </div>
  )
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <CatalogSurface data={loaderData} />
}

export function HydrateFallback() {
  return (
    <div className="catalog-page" aria-label="Loading catalog">
      <div className="catalog-frame">
        <header className="catalog-header">
          <span className="catalog-brand" aria-hidden="true">
            FindThatProject<span>/</span>
          </span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-32" />
        </header>
        <main id="main-content" className="index-main">
          <div className="ledger-overview">
            <Skeleton className="h-24 w-72" />
            <Skeleton className="h-9 w-52" />
          </div>
          <div className="ledger-controls">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-8 w-96 max-w-full" />
          </div>
          <div className="ledger-loading-list">
            <Skeleton className="h-56 w-full" />
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
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
