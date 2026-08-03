import type { CatalogListItem, TechnologyKind } from "@techdex/contracts"
import { AlertCircleIcon, SlidersHorizontalIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation, useRevalidator, useSearchParams } from "react-router"

import type { Route } from "./+types/home"
import {
  SearchControls,
  type CategoryFilterOption,
  type KindFilterOption,
  type TagFilterOption,
} from "~/components/search-controls"
import { ToolList } from "~/components/tool-list"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet"
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
import { canonicalMeta } from "~/domain/urls"

export function meta() {
  return [
    { title: "TechDex · Find the technology you know you saw" },
    {
      name: "description",
      content:
        "Search a cross-channel index of technology mentioned by trusted public Telegram channels, with evidence back to each original post.",
    },
    ...canonicalMeta("/"),
  ]
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  return loadHomeCatalog(request.url, request.signal)
}
clientLoader.hydrate = true as const

const kindOrder: readonly TechnologyKind[] = [
  "GUIDE",
  "LIBRARY",
  "PRODUCT",
  "PROJECT",
  "TOOL",
  "SERVICE",
  "FEATURE",
  "PLUGIN",
  "SKILL",
  "CHEAT_SHEET",
  "PODCAST",
  "OTHER_TECH",
]

function CatalogSurface({ data }: { readonly data: HomeCatalogData }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [items, setItems] = useState<readonly CatalogListItem[]>(
    () => data.catalog.items
  )
  const [nextCursor, setNextCursor] = useState(data.catalog.nextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreFailed, setLoadMoreFailed] = useState(false)
  const activeRequest = useRef<AbortController | null>(null)
  const filters = filtersFromActive(data.catalog.filters)
  const totalCount = data.facets.categories.reduce(
    (total, facet) => total + facet.count,
    0
  )
  const kindOptions: readonly KindFilterOption[] = [...data.facets.kinds].sort(
    (left, right) =>
      kindOrder.indexOf(left.value) - kindOrder.indexOf(right.value)
  )
  const categoryOptions: readonly CategoryFilterOption[] =
    data.facets.categories
  const tagOptions: readonly TagFilterOption[] = [...data.facets.tags].sort(
    (left, right) =>
      right.count - left.count || left.value.localeCompare(right.value)
  )
  const activeFilterCount =
    Number(Boolean(filters.query)) +
    Number(Boolean(filters.kind)) +
    Number(Boolean(filters.category)) +
    Number(Boolean(filters.channel)) +
    filters.tags.length

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

  function clearFilters() {
    updateFilters({ query: "", tags: [], sort: filters.sort })
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
    } catch (error) {
      if (!controller.signal.aborted) setLoadMoreFailed(true)
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false)
    }
  }

  const searchControlProps = {
    filters,
    resultCount: items.length,
    totalCount,
    channelCount: data.channels.channels.length,
    channels: data.channels.channels,
    categoryOptions,
    kindOptions,
    tagOptions,
    onChange: updateFilters,
  } as const

  return (
    <div className="index-shell">
      <aside className="filter-panel" aria-label="Index filters">
        <SearchControls {...searchControlProps} enableShortcut />
      </aside>

      <main id="main-content" tabIndex={-1} className="index-main">
        <div className="mobile-index-bar">
          <span className="mobile-brand">
            TechDex<span>/</span>
          </span>
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" aria-label="Open index filters">
                <SlidersHorizontalIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="mobile-filter-count">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="mobile-filter-sheet">
              <SheetHeader className="sr-only">
                <SheetTitle>Index filters</SheetTitle>
                <SheetDescription>
                  Search and filter the TechDex index.
                </SheetDescription>
              </SheetHeader>
              <div className="mobile-filter-scroll">
                <SearchControls {...searchControlProps} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="index-surface">
          <header className="index-header">
            <div className="index-title-lockup">
              <h1>Find the technology you know you saw.</h1>
              <span>Public Telegram technology index</span>
            </div>
            <p>
              Cross-channel archive of everything worth remembering — every
              entry carries evidence back to its original post.
            </p>
          </header>

          <section className="index-sort-bar" aria-labelledby="results-heading">
            <h2 id="results-heading">
              {items.length}
              {nextCursor ? "+" : ""} {items.length === 1 ? "entry" : "entries"}
            </h2>
            <div className="sort-controls" aria-label="Sort entries">
              <span>Sort</span>
              <Button
                variant="outline"
                size="sm"
                data-active={filters.sort === "latest" || undefined}
                aria-pressed={filters.sort === "latest"}
                onClick={() => updateFilters({ ...filters, sort: "latest" })}
              >
                Recent
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-active={filters.sort === "name" || undefined}
                aria-pressed={filters.sort === "name"}
                onClick={() => updateFilters({ ...filters, sort: "name" })}
              >
                A–Z
              </Button>
            </div>
          </section>

          <ToolList
            tools={items}
            search={location.search}
            onClear={clearFilters}
            emptyState={totalCount === 0 ? "database" : "filtered"}
          />

          {loadMoreFailed ? (
            <Alert className="catalog-inline-alert" variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertTitle>More entries could not be loaded</AlertTitle>
              <AlertDescription>
                The entries already shown are still available. Retry the next
                page when the API is reachable.
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
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? "Loading more…" : "Load more entries"}
              </Button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <CatalogSurface data={loaderData} />
}

export function HydrateFallback() {
  return (
    <div className="index-shell" aria-label="Loading catalog">
      <aside className="filter-panel" aria-hidden="true">
        <div className="filter-panel-content flex flex-col gap-4">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </aside>
      <main id="main-content" className="index-main">
        <div className="index-surface">
          <header className="index-header">
            <div className="flex w-full flex-col gap-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </header>
          <div className="tool-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <article key={index} className="tool-card p-4">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="mt-5 h-7 w-3/4" />
                <Skeleton className="mt-3 h-16 w-full" />
              </article>
            ))}
          </div>
        </div>
      </main>
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
          TechDex will not substitute sample entries. Retry the live catalog
          request.
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
