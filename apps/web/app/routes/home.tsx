import { CircleCheckIcon, XIcon } from "lucide-react"
import { useSyncExternalStore } from "react"
import { useLocation, useSearchParams } from "react-router"

import { SearchControls } from "~/components/search-controls"
import { ToolList } from "~/components/tool-list"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { channels, channelsById } from "~/data/channels"
import { categories, tags, tools } from "~/data/tools"
import {
  parseSearchParams,
  searchTools,
  serializeSearchParams,
  type SearchFilters,
} from "~/domain/search"
import { canonicalMeta } from "~/domain/urls"

export function meta() {
  return [
    { title: "TechDex · Browse trusted Telegram technology mentions" },
    {
      name: "description",
      content:
        "Browse technology subjects mentioned by trusted public Telegram channels, with dates and source provenance.",
    },
    ...canonicalMeta("/"),
  ]
}

const indexedChannelIds = new Set(
  tools.flatMap((tool) => tool.mentions.map((mention) => mention.channelId))
)
const indexedChannels = channels.filter((channel) =>
  indexedChannelIds.has(channel.id)
)
const searchOptions = {
  categories,
  channelIds: indexedChannels.map((channel) => channel.id),
  tags,
} as const
const emptySearchParams = new URLSearchParams()

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

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const hydrated = useHydrated()
  const filters = parseSearchParams(
    hydrated ? searchParams : emptySearchParams,
    searchOptions
  )
  const results = searchTools(tools, filters)
  const hasFilters = Boolean(
    filters.category || filters.channelId || filters.tags.length
  )

  function updateFilters(next: SearchFilters, replace = false) {
    setSearchParams(serializeSearchParams(next), { replace })
  }

  function clearFilters() {
    updateFilters({ query: "", tags: [] })
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="page-width pt-10 pb-16 md:pt-16 md:pb-24"
    >
      <section className="search-stage" aria-labelledby="search-heading">
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Public Telegram technology index
        </p>
        <h1
          id="search-heading"
          className="mt-4 max-w-4xl font-heading text-5xl font-semibold tracking-[-0.06em] text-balance md:text-7xl lg:text-8xl"
        >
          Browse the technology worth finding again.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Filter the audited archive by category, source channel, or tag—then
          follow the evidence back to the original post.
        </p>

        <div className="mt-10 border-y py-6 md:mt-12 md:py-8">
          <SearchControls
            filters={filters}
            categories={categories}
            channels={indexedChannels}
            tags={tags}
            onChange={updateFilters}
          />
        </div>
      </section>

      <Alert className="mt-6">
        <CircleCheckIcon aria-hidden="true" />
        <AlertTitle>Audited source corpus</AlertTitle>
        <AlertDescription>
          Every indexed subject has verified public provenance. Text search is
          intentionally deferred; use the source, category, and tag filters for
          now.
        </AlertDescription>
      </Alert>

      <section className="mt-10" aria-labelledby="results-heading">
        <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Indexed subjects
            </p>
            <h2 id="results-heading" className="mt-2 text-2xl font-semibold">
              {results.length} {results.length === 1 ? "entry" : "entries"}
            </h2>
          </div>

          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XIcon data-icon="inline-start" aria-hidden="true" />
              Clear all
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sorted alphabetically
            </p>
          )}
        </div>

        {hasFilters ? (
          <div
            className="active-filter flex flex-wrap items-center gap-2 border-b py-4"
            aria-label="Active filters"
          >
            <span className="text-sm text-muted-foreground">Active:</span>
            {filters.category ? (
              <Badge variant="secondary">Category · {filters.category}</Badge>
            ) : null}
            {filters.channelId ? (
              <Badge variant="secondary">
                Source ·
                {` @${new URL(
                  channelsById.get(filters.channelId)?.publicUrl ?? ""
                ).pathname.replace(/^\//u, "")}`}
              </Badge>
            ) : null}
            {filters.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                Tag · {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <ToolList
          tools={results}
          search={hydrated ? location.search : ""}
          onClear={clearFilters}
        />
      </section>
    </main>
  )
}
