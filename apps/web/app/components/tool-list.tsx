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
import { formatTechnologyKindPlural } from "~/domain/tools"

export type LedgerEmptyState = {
  readonly title: string
  readonly body: string
  readonly actionLabel?: string
  readonly onAction?: () => void
}

type ToolListProps = {
  readonly tools: readonly CatalogListItem[]
  readonly search: string
  readonly unseenSlugs: ReadonlySet<string>
  readonly onMarkSeen: (slug: string) => void
  readonly emptyState: LedgerEmptyState
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
      let reason: string

      if (index === 0 && tool.githubStars !== null) {
        reason = "highest traction in this view"
      } else if (rank && rank <= 2) {
        reason = `#${rank} by stars among visible ${formatTechnologyKindPlural(
          tool.kind
        )}`
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
  emptyState,
}: ToolListProps) {
  if (tools.length === 0) {
    return (
      <Empty className="ledger-empty-state">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{emptyState.title}</EmptyTitle>
          <EmptyDescription>{emptyState.body}</EmptyDescription>
        </EmptyHeader>
        {emptyState.actionLabel && emptyState.onAction ? (
          <EmptyContent>
            <Button variant="ink" size="pill" onClick={emptyState.onAction}>
              {emptyState.actionLabel}
            </Button>
          </EmptyContent>
        ) : null}
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
