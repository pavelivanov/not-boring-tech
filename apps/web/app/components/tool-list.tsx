import type { CatalogListItem } from "@findthatproject/contracts"
import { SearchXIcon } from "lucide-react"

import { ToolCard } from "~/components/tool-card"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { formatTechnologyKind } from "~/domain/tools"

type ToolListProps = {
  readonly tools: readonly CatalogListItem[]
  readonly search: string
  readonly unseenSlugs: ReadonlySet<string>
  readonly onMarkSeen: (slug: string) => void
  readonly onClear: () => void
  readonly onBrowseIndex: () => void
  readonly emptyState: "database" | "filtered" | "caught-up"
}

function pluralizeKind(label: string): string {
  if (label === "Library") return "libraries"
  if (label === "Technology") return "technologies"
  return `${label.toLocaleLowerCase("en")}s`
}

function buildReasons(
  tools: readonly CatalogListItem[]
): ReadonlyMap<string, string> {
  const rankBySlug = new Map<string, number>()
  const byKind = new Map<string, CatalogListItem[]>()

  for (const tool of tools) {
    if (tool.githubStars === null) continue
    const entries = byKind.get(tool.kind) ?? []
    entries.push(tool)
    byKind.set(tool.kind, entries)
  }

  for (const entries of byKind.values()) {
    entries
      .toSorted(
        (left, right) => (right.githubStars ?? 0) - (left.githubStars ?? 0)
      )
      .forEach((tool, index) => rankBySlug.set(tool.slug, index + 1))
  }

  return new Map(
    tools.map((tool, index) => {
      const rank = rankBySlug.get(tool.slug)
      const kindLabel = formatTechnologyKind(tool.kind)
      let reason: string

      if (index === 0 && tool.githubStars !== null) {
        reason = "highest traction in this view"
      } else if (rank && rank <= 2) {
        reason = `#${rank} by stars among visible ${pluralizeKind(kindLabel)}`
      } else if (tool.mentionCount > 1) {
        reason = `${tool.mentionCount} mentions across ${tool.channelCount} ${
          tool.channelCount === 1 ? "source" : "sources"
        }`
      } else {
        reason = "first indexed from a trusted source"
      }

      return [tool.slug, reason]
    })
  )
}

export function ToolList({
  tools,
  search,
  unseenSlugs,
  onMarkSeen,
  onClear,
  onBrowseIndex,
  emptyState,
}: ToolListProps) {
  if (tools.length === 0) {
    const caughtUp = emptyState === "caught-up"
    const databaseEmpty = emptyState === "database"

    return (
      <Empty className="ledger-empty-state">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            {caughtUp
              ? "You are caught up."
              : databaseEmpty
                ? "No parsed entries yet"
                : "No entries match this combination"}
          </EmptyTitle>
          <EmptyDescription>
            {caughtUp
              ? "Every entry in your queue has been read. New ones will appear here as the index grows."
              : databaseEmpty
                ? "The index will populate after the configured public channels complete a parser run."
                : "Try a shorter search, another type, or clear the current filters."}
          </EmptyDescription>
        </EmptyHeader>
        {databaseEmpty ? null : (
          <EmptyContent>
            <Button
              variant="ink"
              size="pill"
              onClick={caughtUp ? onBrowseIndex : onClear}
            >
              {caughtUp ? "Browse the whole index" : "Clear filters"}
            </Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }

  const maxStars = tools.reduce(
    (maximum, tool) => Math.max(maximum, tool.githubStars ?? 0),
    0
  )
  const reasons = buildReasons(tools)

  return (
    <div className="ledger-list" aria-live="polite">
      {tools.map((tool, index) => (
        <ToolCard
          key={tool.slug}
          tool={tool}
          search={search}
          unseen={unseenSlugs.has(tool.slug)}
          featured={index === 0}
          maxStars={maxStars}
          reason={reasons.get(tool.slug) ?? "worth a closer look"}
          onMarkSeen={onMarkSeen}
        />
      ))}
    </div>
  )
}
