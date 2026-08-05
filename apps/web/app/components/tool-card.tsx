import type { CatalogListItem } from "@findthatproject/contracts"
import { ArrowUpRightIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router"

import { formatTechnologyKind } from "~/domain/tools"

type ToolCardProps = {
  readonly tool: CatalogListItem
  readonly search: string
  readonly unseen: boolean
  readonly featured?: boolean
  readonly maxStars: number
  readonly reason: string
  readonly onMarkSeen: (slug: string) => void
}

type EntryLinkProps = {
  readonly tool: CatalogListItem
  readonly search: string
  readonly className: string
  readonly children: ReactNode
  readonly onOpen: () => void
}

const compactCountFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const exactCountFormatter = new Intl.NumberFormat("en")

function EntryLink({
  tool,
  search,
  className,
  children,
  onOpen,
}: EntryLinkProps) {
  if (tool.canonicalUrl) {
    return (
      <a
        href={tool.canonicalUrl}
        target="_blank"
        rel="noreferrer"
        className={className}
        aria-label={`${tool.name} project (opens in a new tab)`}
        onClick={onOpen}
      >
        {children}
      </a>
    )
  }

  return (
    <Link
      to={`/tools/${tool.slug}`}
      state={{ from: search }}
      className={className}
      aria-label={`Read ${tool.name}`}
      onClick={onOpen}
    >
      {children}
    </Link>
  )
}

function Stars({
  stars,
  maxStars,
  featured,
}: {
  readonly stars: number | null
  readonly maxStars: number
  readonly featured: boolean
}) {
  if (stars === null) {
    return (
      <div
        className="ledger-stars ledger-stars-empty"
        aria-label="No GitHub stars"
      >
        <span>—</span>
      </div>
    )
  }

  const width =
    maxStars > 0
      ? Math.max(
          7,
          Math.round((Math.log10(stars + 1) / Math.log10(maxStars + 1)) * 100)
        )
      : 0

  return (
    <div
      className="ledger-stars"
      aria-label={`${exactCountFormatter.format(stars)} GitHub stars`}
      title={`${exactCountFormatter.format(stars)} GitHub stars`}
    >
      <span className="ledger-stars-value">
        {compactCountFormatter.format(stars)}
      </span>
      {featured ? <small>GitHub stars</small> : null}
      <span className="ledger-stars-track" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </span>
    </div>
  )
}

export function ToolCard({
  tool,
  search,
  unseen,
  featured = false,
  maxStars,
  reason,
  onMarkSeen,
}: ToolCardProps) {
  const kindLabel = formatTechnologyKind(tool.kind)
  const markSeen = () => onMarkSeen(tool.slug)
  const detailPath = `/tools/${tool.slug}`

  if (featured) {
    return (
      <article className="ledger-lead" data-unseen={unseen || undefined}>
        <EntryLink
          tool={tool}
          search={search}
          className="ledger-lead-main"
          onOpen={markSeen}
        >
          <div className="ledger-lead-copy">
            <p className="ledger-entry-kind">
              {kindLabel}
              {unseen ? <span className="ledger-unseen-dot" /> : null}
            </p>
            <h2>{tool.name}</h2>
            <p className="ledger-entry-description">{tool.descriptionEn}</p>
            <p className="ledger-entry-reason">{reason}</p>
          </div>
          <Stars stars={tool.githubStars} maxStars={maxStars} featured />
        </EntryLink>

        <Link
          to={detailPath}
          state={{ from: search }}
          className="ledger-provenance-link ledger-provenance-lead"
          aria-label={`View ${tool.name} provenance`}
          onClick={markSeen}
        >
          <ArrowUpRightIcon aria-hidden="true" />
        </Link>
      </article>
    )
  }

  return (
    <article className="ledger-row" data-unseen={unseen || undefined}>
      <EntryLink
        tool={tool}
        search={search}
        className="ledger-row-main"
        onOpen={markSeen}
      >
        <p className="ledger-entry-kind">{kindLabel}</p>
        <div className="ledger-row-title">
          <h3>
            {unseen ? <span className="ledger-unseen-dot" /> : null}
            {tool.name}
          </h3>
          <p className="ledger-entry-reason">{reason}</p>
        </div>
        <p className="ledger-entry-description">{tool.descriptionEn}</p>
        <Stars stars={tool.githubStars} maxStars={maxStars} featured={false} />
      </EntryLink>

      <Link
        to={detailPath}
        state={{ from: search }}
        className="ledger-provenance-link"
        aria-label={`View ${tool.name} provenance`}
        onClick={markSeen}
      >
        <ArrowUpRightIcon aria-hidden="true" />
      </Link>
    </article>
  )
}
