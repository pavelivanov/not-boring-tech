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

export type LedgerEmptyState = {
  readonly title: string
  readonly body: string
  readonly actionLabel?: string
  readonly onAction?: () => void
}

type ToolListProps = {
  readonly tools: readonly CatalogListItem[]
  readonly unseenSlugs: ReadonlySet<string>
  readonly onMarkSeen: (slug: string) => void
  readonly emptyState: LedgerEmptyState
}

export function ToolList({
  tools,
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

  return (
    <div className="ledger-list" aria-live="polite">
      {tools.map((tool) => (
        <ToolCard
          key={tool.slug}
          tool={tool}
          unseen={unseenSlugs.has(tool.slug)}
          onMarkSeen={onMarkSeen}
        />
      ))}
    </div>
  )
}
