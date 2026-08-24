import type { CatalogListItem } from "@findthatproject/contracts"
import { SearchXIcon } from "lucide-react"
import { Link } from "react-router"

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
  readonly variant?: "default" | "caught-up"
  readonly actionLabel?: string
  readonly onAction?: () => void
  readonly primaryLink?: {
    readonly label: string
    readonly to: string
  }
  readonly secondaryActionLabel?: string
  readonly onSecondaryAction?: () => void
}

type ToolListProps = {
  readonly tools: readonly CatalogListItem[]
  readonly unseenSlugs: ReadonlySet<string>
  readonly onMarkSeen: (slug: string) => void
  readonly emptyState: LedgerEmptyState
  readonly showUnseenMarker?: boolean
}

export function ToolList({
  tools,
  unseenSlugs,
  onMarkSeen,
  emptyState,
  showUnseenMarker = true,
}: ToolListProps) {
  if (tools.length === 0) {
    const isCaughtUp = emptyState.variant === "caught-up"

    return (
      <Empty
        className="ledger-empty-state"
        data-variant={emptyState.variant ?? "default"}
        role={isCaughtUp ? "status" : undefined}
      >
        <EmptyHeader>
          {isCaughtUp ? null : (
            <EmptyMedia variant="icon">
              <SearchXIcon aria-hidden="true" />
            </EmptyMedia>
          )}
          <EmptyTitle role="heading" aria-level={2}>
            {emptyState.title}
          </EmptyTitle>
          <EmptyDescription>{emptyState.body}</EmptyDescription>
        </EmptyHeader>

        {emptyState.primaryLink &&
        emptyState.secondaryActionLabel &&
        emptyState.onSecondaryAction ? (
          <EmptyContent className="ledger-caught-up-actions">
            <Button asChild variant="ink" size="ledger">
              <Link to={emptyState.primaryLink.to}>
                {emptyState.primaryLink.label}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="ledger"
              onClick={emptyState.onSecondaryAction}
            >
              {emptyState.secondaryActionLabel}
            </Button>
          </EmptyContent>
        ) : emptyState.actionLabel && emptyState.onAction ? (
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
          showUnseenMarker={showUnseenMarker}
        />
      ))}
    </div>
  )
}
