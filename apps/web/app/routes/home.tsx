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
import { LocaleSwitcher } from "~/components/locale-switcher"
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
import { formatVisitDate } from "~/domain/dates"
import {
  filtersFromActive,
  serializeSearchParams,
  type SearchFilters,
} from "~/domain/search"
import { formatTechnologyKind } from "~/domain/tools"
import { canonicalMeta } from "~/domain/urls"
import { useLocale } from "~/lib/locale"

export function meta() {
  return [
    { title: "New · FindThatProject" },
    {
      name: "description",
      content:
        "Catch up on technology added to FindThatProject since your last visit.",
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
export type CatalogPageMode = "new" | "index"

type NewEntryGroup = {
  readonly key: "day" | "week" | "older"
  readonly items: readonly CatalogListItem[]
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

function groupNewEntries(
  entries: readonly CatalogListItem[],
  referenceTime: number
): readonly NewEntryGroup[] {
  const day = 24 * 60 * 60 * 1_000
  const groups: Record<NewEntryGroup["key"], CatalogListItem[]> = {
    day: [],
    week: [],
    older: [],
  }

  for (const entry of entries) {
    const age = Math.max(0, referenceTime - Date.parse(entry.firstMentionedAt))
    const key = age <= day ? "day" : age <= day * 7 ? "week" : "older"
    groups[key].push(entry)
  }

  return (["day", "week", "older"] as const).flatMap((key) =>
    groups[key].length > 0 ? [{ key, items: groups[key] }] : []
  )
}

export function CatalogSurface({
  data,
  mode,
}: {
  readonly data: HomeCatalogData
  readonly mode: CatalogPageMode
}) {
  const { locale, copy } = useLocale()
  const [, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigation = useNavigation()
  const [sort, setSort] = useState<LedgerSort>("traction")
  const [seenSlugs, setSeenSlugs] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [sessionReadSlugs, setSessionReadSlugs] = useState<ReadonlySet<string>>(
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

  const visibleItems = useMemo(() => {
    const inScope =
      mode === "new"
        ? items.filter(
            (item) =>
              unseenSlugs.has(item.slug) || sessionReadSlugs.has(item.slug)
          )
        : items

    return inScope.toSorted(
      mode === "new" || sort === "newest" ? compareNewest : compareTraction
    )
  }, [items, mode, sessionReadSlugs, sort, unseenSlugs])

  const newEntryGroups = useMemo(
    () => groupNewEntries(visibleItems, Date.now()),
    [visibleItems]
  )

  const newKindOptions = useMemo(() => {
    const counts = new Map<TechnologyKind, number>()
    for (const item of unseenEntries) {
      counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1)
    }

    return kindOptions
      .map((option) => ({
        value: option.value,
        count: counts.get(option.value) ?? 0,
      }))
      .filter((option) => option.count > 0)
  }, [kindOptions, unseenEntries])

  const markSeen = useCallback((slug: string) => {
    setSessionReadSlugs((current) => {
      if (current.has(slug)) return current
      const next = new Set(current)
      next.add(slug)
      return next
    })
    setSeenSlugs((current) => {
      if (current.has(slug)) return current
      const next = new Set(current)
      next.add(slug)
      return next
    })
  }, [])

  function markAllSeen() {
    setSessionReadSlugs(new Set())
    setSeenSlugs((current) => new Set([...current, ...knownEntries.keys()]))
    setSeenThrough(new Date().toISOString())
  }

  function resetReadState() {
    setSessionReadSlugs(new Set())
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
    ? formatVisitDate(previousVisit, locale)
    : null
  const query = filters.query.trim()
  const kindLabel = filters.kind
    ? formatTechnologyKind(filters.kind, locale)
    : null
  const shownCount = visibleItems.length
  const unseenCount = unseenEntries.length
  const scopeCount = filters.kind
    ? (kindOptions.find((option) => option.value === filters.kind)?.count ??
      shownCount)
    : totalCount
  const isCaughtUp =
    mode === "new" && unseenCount === 0 && knownEntries.size > 0

  function scopeLine() {
    if (isFiltering) return copy.home.updatingEntries

    const counts = ` · ${copy.home.showing(shownCount, scopeCount)}`

    // The scope line is set in uppercase mono, so the searched term keeps its
    // own casing to stay recognisable as what was typed.
    return query ? (
      <>
        {copy.home.searchScope}{" "}
        <span className="ledger-scope-term">“{query}”</span>
        {counts}
      </>
    ) : (
      `${kindLabel ?? copy.home.all}${counts}`
    )
  }

  function resolveEmptyState(): LedgerEmptyState {
    if (totalCount === 0) {
      return {
        title: copy.home.noParsedTitle,
        body: copy.home.noParsedBody,
      }
    }

    if (isCaughtUp) {
      return {
        title: copy.home.caughtUpTitle,
        body: copy.home.caughtUpBody(lastVisitDate),
        variant: "caught-up",
        primaryLink: {
          label: copy.home.browseFullIndex,
          to: "/index",
        },
        secondaryActionLabel: copy.home.showThemAgain,
        onSecondaryAction: resetReadState,
      }
    }

    if (query) {
      if (mode === "new" && items.length > 0) {
        return {
          title: copy.home.noNewQueryTitle(query),
          body:
            items.length === 1
              ? copy.home.oneOldQueryMatch
              : copy.home.oldQueryMatches(items.length),
          actionLabel: copy.home.searchWholeIndex,
          onAction: clearFilters,
        }
      }

      return {
        title: copy.home.noQueryTitle(query),
        body: kindLabel
          ? copy.home.nothingUnderKind(kindLabel)
          : copy.home.queryHint,
        actionLabel: kindLabel
          ? copy.home.clearSearchAndFilter
          : copy.home.clearSearch,
        onAction: clearFilters,
      }
    }

    if (mode === "new") {
      if (kindLabel) {
        return {
          title: copy.home.nothingNewUnder(kindLabel),
          body: copy.home.otherTypesNew,
          actionLabel: copy.home.allNewEntries,
          onAction: () => changeKind(),
        }
      }

      return {
        title: copy.home.readEverything,
        body: copy.home.readEverythingBody,
      }
    }

    if (kindLabel) {
      return {
        title: copy.home.nothingIndexedUnder(kindLabel),
        body: copy.home.trackedButEmpty,
        actionLabel: copy.home.showAllTypes,
        onAction: () => changeKind(),
      }
    }

    return {
      title: copy.home.noCombination,
      body: copy.home.noCombinationBody,
      actionLabel: copy.home.clearFilters,
      onAction: clearFilters,
    }
  }

  const catalogTail = (
    <>
      {loadMoreFailed ? (
        <Alert className="catalog-inline-alert" variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>{copy.home.loadFailureTitle}</AlertTitle>
          <AlertDescription>{copy.home.loadFailureBody}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={loadMore}>
              {copy.common.retry}
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
            {loadingMore ? copy.home.loadingMore : copy.home.loadMore}
          </button>
        </div>
      ) : null}
    </>
  )

  return (
    <div className="index-page" data-page={mode}>
      <header className="index-header">
        <div className="index-brand-block">
          <Link to="/" className="index-brand" aria-label={copy.home.homeLabel}>
            FindThatProject<span>/</span>
          </Link>
          <p className="index-tagline">{copy.home.tagline}</p>
        </div>

        <nav className="index-view-switcher" aria-label={copy.home.views}>
          <Link to="/" aria-current={mode === "new" ? "page" : undefined}>
            {copy.home.newView}
            <span>{unseenCount}</span>
          </Link>
          <Link
            to="/index"
            aria-current={mode === "index" ? "page" : undefined}
          >
            {copy.home.indexView}
          </Link>
        </nav>

        <div className="index-header-tools">
          <IndexSearchDialog
            entries={[...knownEntries.values()]}
            suggestions={unseenEntries}
            query={filters.query}
            onSubmitQuery={(next) => updateFilters({ ...filters, query: next })}
            onOpenEntry={markSeen}
          />

          {digestLinks.length > 0 ? (
            <>
              <span className="index-header-divider" aria-hidden="true" />
              <div className="index-digest">
                <span>{copy.home.weeklyDigest}</span>
                {digestLinks.map((channel) => (
                  <a
                    key={channel.handle}
                    href={channel.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={copy.home.digestLabel(channel.locale)}
                  >
                    <TelegramIcon />
                    {channel.locale}
                  </a>
                ))}
              </div>
            </>
          ) : null}

          <span className="index-header-divider" aria-hidden="true" />
          <LocaleSwitcher />
        </div>
      </header>

      {mode === "new" ? (
        <main id="main-content" tabIndex={-1} className="new-main">
          <section
            className="new-hero"
            data-caught-up={isCaughtUp || undefined}
            aria-labelledby="new-page-title"
          >
            <p className="new-eyebrow">
              <span aria-hidden="true" />
              {lastVisitDate
                ? copy.home.sinceVisit(lastVisitDate)
                : copy.home.newToIndex}
            </p>

            <div className="new-title-row">
              <h1 id="new-page-title" aria-live="polite">
                {isCaughtUp
                  ? copy.home.unseenTitle(0)
                  : unseenCount > 0
                    ? copy.home.unseenTitle(unseenCount)
                    : knownEntries.size > 0
                      ? copy.home.readEverything
                      : copy.home.unseenTitle(0)}
              </h1>
              {unseenCount > 0 ? (
                <button
                  type="button"
                  className="new-mark-seen"
                  onClick={markAllSeen}
                >
                  {copy.home.markAllSeen}
                </button>
              ) : null}
            </div>

            {isCaughtUp ? null : (
              <nav
                className="new-kind-filters"
                aria-label={copy.home.newFilters}
              >
                <button
                  type="button"
                  aria-pressed={!filters.kind}
                  onClick={() => changeKind()}
                >
                  <span>{copy.home.all}</span>
                  <span>{unseenCount}</span>
                </button>
                {newKindOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={filters.kind === option.value}
                    onClick={() => changeKind(option.value)}
                  >
                    <span>{formatTechnologyKind(option.value, locale)}</span>
                    <span>{option.count}</span>
                  </button>
                ))}
              </nav>
            )}
          </section>

          <div
            className="new-feed"
            data-caught-up={isCaughtUp || undefined}
            aria-busy={isFiltering}
          >
            {newEntryGroups.length > 0 ? (
              newEntryGroups.map((group) => (
                <section className="new-entry-group" key={group.key}>
                  <header>
                    <h2>{copy.home.newGroup[group.key]}</h2>
                    <span>{copy.home.entryCount(group.items.length)}</span>
                  </header>
                  <ToolList
                    tools={group.items}
                    unseenSlugs={unseenSlugs}
                    onMarkSeen={markSeen}
                    emptyState={resolveEmptyState()}
                  />
                </section>
              ))
            ) : (
              <ToolList
                tools={[]}
                unseenSlugs={unseenSlugs}
                onMarkSeen={markSeen}
                emptyState={resolveEmptyState()}
              />
            )}
            {catalogTail}
          </div>
        </main>
      ) : (
        <div className="index-body">
          <aside className="index-sidebar" aria-label={copy.home.indexFilters}>
            <div className="index-facet">
              <h2 className="index-facet-title">{copy.home.type}</h2>
              <nav className="index-facet-list">
                <button
                  type="button"
                  className="index-facet-option"
                  aria-pressed={!filters.kind}
                  onClick={() => changeKind()}
                >
                  <span>{copy.home.all}</span>
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
                    <span>{formatTechnologyKind(option.value, locale)}</span>
                    <span>{option.count}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="index-facet index-facet-sort">
              <h2 className="index-facet-title">{copy.home.sort}</h2>
              <div className="index-facet-list">
                <button
                  type="button"
                  className="index-facet-option"
                  aria-pressed={sort === "traction"}
                  onClick={() => setSort("traction")}
                >
                  <span>{copy.home.traction}</span>
                </button>
                <button
                  type="button"
                  className="index-facet-option"
                  aria-pressed={sort === "newest"}
                  onClick={() => setSort("newest")}
                >
                  <span>{copy.home.newest}</span>
                </button>
              </div>
            </div>

            <Link to="/" className="index-new-callout">
              <span aria-hidden="true" />
              {copy.home.newCount(unseenCount)}
            </Link>
          </aside>

          <main id="main-content" tabIndex={-1} className="index-main">
            <h1 className="sr-only">{copy.home.pageTitle}</h1>
            <div className="ledger-scope">
              <p aria-live="polite">{scopeLine()}</p>
              <p>
                {sort === "newest"
                  ? copy.home.newestFirst
                  : copy.home.sortedByTraction}
              </p>
            </div>

            <div className="index-surface" aria-busy={isFiltering}>
              <ToolList
                tools={visibleItems}
                unseenSlugs={unseenSlugs}
                onMarkSeen={markSeen}
                emptyState={resolveEmptyState()}
              />
              {catalogTail}
            </div>
          </main>
        </div>
      )}

      <footer className="index-footer">
        <p>
          {copy.home.footer.split("@findthatproject")[0]}
          <a
            href="https://t.me/findthatproject"
            target="_blank"
            rel="noreferrer"
          >
            @findthatproject
          </a>
          {copy.home.footer.split("@findthatproject")[1]}
        </p>
        <span>
          {copy.home.indexedCount(totalCount, data.facets.kinds.length)}
        </span>
      </footer>
    </div>
  )
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <CatalogSurface data={loaderData} mode="new" />
}

export function HydrateFallback() {
  return <CatalogHydrateFallback mode="new" />
}

export function CatalogHydrateFallback({
  mode,
}: {
  readonly mode: CatalogPageMode
}) {
  const { copy } = useLocale()

  return (
    <div className="index-page" aria-label={copy.home.loadingCatalog}>
      <header className="index-header">
        <div className="index-brand-block">
          <span className="index-brand" aria-hidden="true">
            FindThatProject<span>/</span>
          </span>
          <p className="index-tagline">{copy.home.tagline}</p>
        </div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-8 w-40" />
      </header>
      <div className={mode === "new" ? "new-main" : "index-body"}>
        {mode === "index" ? (
          <aside className="index-sidebar">
            <Skeleton className="h-64 w-full" />
          </aside>
        ) : null}
        <main
          id="main-content"
          className={mode === "new" ? "new-feed" : "index-main"}
        >
          <Skeleton className="h-24 w-full" />
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
  const { copy } = useLocale()
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
        <AlertTitle>{copy.home.apiUnavailable}</AlertTitle>
        <AlertDescription>
          {copy.home.apiUnavailableBody}
          {requestId ? ` ${copy.home.requestId}: ${requestId}.` : ""}
        </AlertDescription>
        <AlertAction>
          <Button
            variant="outline"
            disabled={revalidator.state !== "idle"}
            onClick={() => revalidator.revalidate()}
          >
            {revalidator.state === "idle"
              ? copy.common.retry
              : copy.common.retrying}
          </Button>
        </AlertAction>
      </Alert>
    </main>
  )
}
