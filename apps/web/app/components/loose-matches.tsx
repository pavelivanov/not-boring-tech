import { ToolCard } from "~/components/tool-card"
import { Button } from "~/components/ui/button"
import type { LooseMatch } from "~/domain/search"

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
  const maxStars = matches.reduce(
    (maximum, match) => Math.max(maximum, match.item.githubStars ?? 0),
    0
  )

  return (
    <div className="ledger-loose">
      <p className="ledger-loose-label">Loose matches</p>

      <div className="ledger-list">
        {matches.map(({ item, term, field }) => (
          <ToolCard
            key={item.slug}
            tool={item}
            search={search}
            unseen={unseenSlugs.has(item.slug)}
            maxStars={maxStars}
            reason={`matched “${term}” in ${field}`}
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
