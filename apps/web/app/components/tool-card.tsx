import type { CatalogListItem } from "@findthatproject/contracts"
import { ArrowUpRightIcon, BookmarkIcon, StarIcon } from "lucide-react"
import { Link } from "react-router"

import { RelativeDate } from "~/components/relative-date"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { formatTechnologyKind } from "~/domain/tools"

type ToolCardProps = {
  readonly tool: CatalogListItem
  readonly search: string
  readonly saved: boolean
  readonly onToggleSaved: (slug: string) => void
}

const compactCountFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const exactCountFormatter = new Intl.NumberFormat("en")

export function ToolCard({
  tool,
  search,
  saved,
  onToggleSaved,
}: ToolCardProps) {
  const kindLabel = formatTechnologyKind(tool.kind)
  const detailPath = `/tools/${tool.slug}`

  return (
    <article className="tool-card">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="tool-save-button"
        data-saved={saved || undefined}
        aria-pressed={saved}
        aria-label={
          saved ? `Remove ${tool.name} from saved` : `Save ${tool.name}`
        }
        title={saved ? "Saved" : "Save"}
        onClick={() => onToggleSaved(tool.slug)}
      >
        <BookmarkIcon aria-hidden="true" />
      </Button>

      <div className="tool-card-body">
        <p className="tool-card-kicker">
          <span>{kindLabel}</span>
        </p>
        <h3>
          {tool.canonicalUrl ? (
            <a href={tool.canonicalUrl} target="_blank" rel="noreferrer">
              {tool.name}
              <span className="sr-only"> project (opens in a new tab)</span>
            </a>
          ) : (
            tool.name
          )}
        </h3>
        <p className="tool-card-description">{tool.descriptionEn}</p>
        <div className="tool-card-tags" aria-label={`${tool.name} tags`}>
          {tool.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <footer className="tool-card-footer">
        <span className="tool-card-meta">
          <RelativeDate value={tool.firstMentionedAt} />
        </span>
        {tool.githubStars !== null ? (
          <span
            className="tool-github-stars"
            aria-label={`${exactCountFormatter.format(tool.githubStars)} GitHub stars`}
            title={`${exactCountFormatter.format(tool.githubStars)} GitHub stars`}
          >
            <StarIcon aria-hidden="true" />
            {compactCountFormatter.format(tool.githubStars)}
          </span>
        ) : null}
        <Link
          to={detailPath}
          state={{ from: search }}
          className="tool-detail-link"
          aria-label={`View ${tool.name} provenance`}
        >
          <ArrowUpRightIcon aria-hidden="true" />
        </Link>
      </footer>
    </article>
  )
}
