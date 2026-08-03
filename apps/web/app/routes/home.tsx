import type { CatalogListItem, TechnologyKind } from "@techdex/contracts"
import {
  AlertCircleIcon,
  ChevronUpIcon,
  ListFilterIcon,
  XIcon,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Link,
  useLocation,
  useRevalidator,
  useSearchParams,
} from "react-router"

import type { Route } from "./+types/home"
import {
  IndexSearch,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
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
  const [filtersOpen, setFiltersOpen] = useState(false)
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

  function clearFacetFilters() {
    updateFilters({ query: filters.query, tags: [], sort: filters.sort })
  }

  function removeKind() {
    const { kind: _kind, ...remainingFilters } = filters
    updateFilters(remainingFilters)
  }

  function removeCategory() {
    const { category: _category, ...remainingFilters } = filters
    updateFilters(remainingFilters)
  }

  function removeChannel() {
    const { channel: _channel, ...remainingFilters } = filters
    updateFilters(remainingFilters)
  }

  function removeTag(tag: string) {
    updateFilters({
      ...filters,
      tags: filters.tags.filter((selectedTag) => selectedTag !== tag),
    })
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

  const filterControlProps = {
    filters,
    resultCount: items.length,
    totalCount,
    channels: data.channels.channels,
    categoryOptions,
    kindOptions,
    tagOptions,
    onChange: updateFilters,
    onDone: () => setFiltersOpen(false),
  } as const

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <Link to="/" className="catalog-brand" aria-label="TechDex home">
          TechDex<span>/</span>
        </Link>

        <IndexSearch
          filters={filters}
          enableShortcut
          onChange={updateFilters}
        />

        <Link to="/about" className="catalog-about-link">
          About
        </Link>
      </header>

      <main id="main-content" tabIndex={-1} className="index-main">
        <h1 className="sr-only">TechDex technology index</h1>

        <section className="catalog-toolbar" aria-labelledby="results-heading">
          <div className="catalog-toolbar-filters">
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger asChild>
                <Button variant="ink" size="pill">
                  <ListFilterIcon data-icon="inline-start" aria-hidden="true" />
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="filter-count" aria-hidden="true">
                      {activeFilterCount}
                    </span>
                  ) : null}
                  <ChevronUpIcon
                    data-icon="inline-end"
                    className="filter-trigger-chevron"
                    aria-hidden="true"
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="filter-popover-content"
                align="start"
                sideOffset={12}
                collisionPadding={16}
              >
                <SearchControls {...filterControlProps} />
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="toolbar-separator" />

            <h2 id="results-heading" className="toolbar-result-count">
              {items.length} of {totalCount} entries
            </h2>

            <div className="toolbar-active-filters" aria-label="Active filters">
              {filters.kind ? (
                <Button
                  variant="secondary"
                  size="pill"
                  aria-label={`Remove type filter ${formatTechnologyKind(filters.kind)}`}
                  onClick={removeKind}
                >
                  {formatTechnologyKind(filters.kind)}
                  <XIcon data-icon="inline-end" aria-hidden="true" />
                </Button>
              ) : null}
              {filters.category ? (
                <Button
                  variant="secondary"
                  size="pill"
                  aria-label={`Remove category filter ${filters.category}`}
                  onClick={removeCategory}
                >
                  {filters.category}
                  <XIcon data-icon="inline-end" aria-hidden="true" />
                </Button>
              ) : null}
              {filters.channel ? (
                <Button
                  variant="secondary"
                  size="pill"
                  aria-label={`Remove source filter ${filters.channel}`}
                  onClick={removeChannel}
                >
                  {data.channels.channels.find(
                    (channel) => channel.handle === filters.channel
                  )?.title ?? filters.channel}
                  <XIcon data-icon="inline-end" aria-hidden="true" />
                </Button>
              ) : null}
              {filters.tags.map((tag) => (
                <Button
                  key={tag}
                  variant="secondary"
                  size="pill"
                  aria-label={`Remove tag filter ${tag}`}
                  onClick={() => removeTag(tag)}
                >
                  {tag}
                  <XIcon data-icon="inline-end" aria-hidden="true" />
                </Button>
              ))}
              {activeFilterCount > 0 ? (
                <Button variant="link" size="sm" onClick={clearFacetFilters}>
                  Clear all
                </Button>
              ) : null}
            </div>
          </div>

          <div className="sort-controls" aria-label="Sort entries">
            <span>Sort</span>
            <Button
              variant={filters.sort === "latest" ? "ink" : "outline"}
              size="pill"
              aria-pressed={filters.sort === "latest"}
              onClick={() => updateFilters({ ...filters, sort: "latest" })}
            >
              Recent
            </Button>
            <Button
              variant={filters.sort === "name" ? "ink" : "outline"}
              size="pill"
              aria-pressed={filters.sort === "name"}
              onClick={() => updateFilters({ ...filters, sort: "name" })}
            >
              A–Z
            </Button>
          </div>
        </section>

        <div className="index-surface">
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
    <div className="catalog-page" aria-label="Loading catalog">
      <header className="catalog-header">
        <span className="catalog-brand" aria-hidden="true">
          TechDex<span>/</span>
        </span>
        <Skeleton className="h-12 w-full max-w-3xl" />
        <Skeleton className="h-4 w-16" />
      </header>
      <main id="main-content" className="index-main">
        <div className="catalog-toolbar">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="index-surface">
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
