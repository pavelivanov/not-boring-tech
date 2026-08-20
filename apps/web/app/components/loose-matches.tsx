import type { CatalogListItem } from "@findthatproject/contracts"

import { ToolCard } from "~/components/tool-card"
import { Button } from "~/components/ui/button"

type LooseMatch = {
  readonly item: CatalogListItem
  readonly term: string
  readonly field: string
}

type LooseMatchListProps = {
  readonly matches: readonly LooseMatch[]
  readonly query: string
  readonly search: string
  readonly unseenSlugs: ReadonlySet<string>
  readonly suggestUrl: string
  readonly onMarkSeen: (slug: string) => void
  readonly onClearSearch: () => void
}

export function LooseMatchList({
  matches,
  query,
  search,
  unseenSlugs,
  suggestUrl,
  onMarkSeen,
  onClearSearch,
}: LooseMatchListProps) {
  return (
    <div className="ledger-loose">
      <p className="ledger-loose-label">Loose matches</p>

      <div className="ledger-list">
        {matches.map(({ item }) => (
          <ToolCard
            key={item.slug}
            tool={item}
            search={search}
            unseen={unseenSlugs.has(item.slug)}
            onMarkSeen={onMarkSeen}
          />
        ))}
      </div>

      <div className="ledger-loose-footer">
        <span>Still not it?</span>
        <Button
          variant="outline"
          size="sm"
          className="ledger-kind-chip"
          onClick={onClearSearch}
        >
          Clear search
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="ledger-kind-chip"
          asChild
        >
          <a href={suggestUrl} target="_blank" rel="noreferrer">
            Suggest {query}
          </a>
        </Button>
      </div>
    </div>
  )
}
