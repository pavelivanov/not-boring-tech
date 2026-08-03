import type { TechnologyKind, Tool } from "@techdex/contracts"
import { SlidersHorizontalIcon } from "lucide-react"
import { useState, useSyncExternalStore } from "react"
import { useLocation, useSearchParams } from "react-router"

import {
  SearchControls,
  type KindFilterOption,
  type TagFilterOption,
} from "~/components/search-controls"
import { ToolList } from "~/components/tool-list"
import { Button } from "~/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet"
import { channels } from "~/data/channels"
import { categories, kinds, tags, tools } from "~/data/tools"
import {
  parseSearchParams,
  searchTools,
  serializeSearchParams,
  type SearchFilters,
} from "~/domain/search"
import { distinctChannelCount } from "~/domain/tools"
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

type SortKey = "mentions" | "recent" | "az"

const indexedChannelIds = new Set(
  tools.flatMap((tool) => tool.mentions.map((mention) => mention.channelId))
)
const indexedChannels = channels.filter((channel) =>
  indexedChannelIds.has(channel.id)
)
const searchOptions = {
  kinds,
  categories,
  channelIds: indexedChannels.map((channel) => channel.id),
  tags,
} as const
const emptySearchParams = new URLSearchParams()
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
const kindOptions: readonly KindFilterOption[] = kinds
  .map((kind) => ({
    value: kind,
    count: tools.filter((tool) => tool.kind === kind).length,
  }))
  .sort(
    (left, right) =>
      kindOrder.indexOf(left.value) - kindOrder.indexOf(right.value)
  )
const tagOptions: readonly TagFilterOption[] = tags
  .map((tag) => ({
    value: tag,
    count: tools.filter((tool) => tool.tags.includes(tag)).length,
  }))
  .sort(
    (left, right) =>
      right.count - left.count || left.value.localeCompare(right.value)
  )

function subscribeToHydration() {
  return () => {}
}

function getClientHydrationState() {
  return true
}

function getServerHydrationState() {
  return false
}

function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationState,
    getServerHydrationState
  )
}

function latestPresentation(tool: Tool): string {
  return tool.mentions.reduce(
    (latest, mention) =>
      mention.publishedAt > latest ? mention.publishedAt : latest,
    tool.mentions[0]?.publishedAt ?? ""
  )
}

function sortTools(results: readonly Tool[], sort: SortKey): readonly Tool[] {
  return [...results].sort((left, right) => {
    if (sort === "az") {
      return left.name.localeCompare(right.name)
    }

    if (sort === "recent") {
      const dateDifference = latestPresentation(right).localeCompare(
        latestPresentation(left)
      )

      return dateDifference || left.name.localeCompare(right.name)
    }

    const mentionDifference = right.mentions.length - left.mentions.length

    if (mentionDifference) {
      return mentionDifference
    }

    return (
      distinctChannelCount(right) - distinctChannelCount(left) ||
      left.name.localeCompare(right.name)
    )
  })
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sort, setSort] = useState<SortKey>("mentions")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const location = useLocation()
  const hydrated = useHydrated()
  const filters = parseSearchParams(
    hydrated ? searchParams : emptySearchParams,
    searchOptions
  )
  const results = sortTools(searchTools(tools, filters), sort)
  const activeFilterCount =
    Number(Boolean(filters.query)) +
    Number(Boolean(filters.kind)) +
    Number(Boolean(filters.category)) +
    Number(Boolean(filters.channelId)) +
    filters.tags.length

  function updateFilters(next: SearchFilters, replace = false) {
    setSearchParams(serializeSearchParams(next), { replace })
  }

  function clearFilters() {
    updateFilters({ query: "", tags: [] })
  }

  const searchControlProps = {
    filters,
    resultCount: results.length,
    totalCount: tools.length,
    channelCount: indexedChannels.length,
    channels: indexedChannels,
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
                {activeFilterCount ? (
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
              {results.length} {results.length === 1 ? "entry" : "entries"}
            </h2>
            <div className="sort-controls" aria-label="Sort entries">
              <span>Sort</span>
              <Button
                variant="outline"
                size="sm"
                data-active={sort === "mentions" || undefined}
                aria-pressed={sort === "mentions"}
                onClick={() => setSort("mentions")}
              >
                Mentions
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-active={sort === "recent" || undefined}
                aria-pressed={sort === "recent"}
                onClick={() => setSort("recent")}
              >
                Recent
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-active={sort === "az" || undefined}
                aria-pressed={sort === "az"}
                onClick={() => setSort("az")}
              >
                A–Z
              </Button>
            </div>
          </section>

          <ToolList
            tools={results}
            search={hydrated ? location.search : ""}
            onClear={clearFilters}
          />
        </div>
      </main>
    </div>
  )
}
