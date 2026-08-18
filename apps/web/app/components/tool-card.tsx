import type { CatalogListItem } from "@findthatproject/contracts"
import type { ReactNode } from "react"
import { Link } from "react-router"

import { TelegramIcon } from "~/components/telegram-icon"
import { formatLedgerDate } from "~/domain/dates"
import { formatTechnologyKind } from "~/domain/tools"

type ToolCardProps = {
  readonly tool: CatalogListItem
  readonly search: string
  readonly unseen: boolean
  readonly onMarkSeen: (slug: string) => void
}

export type EntryLinkProps = {
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

export function EntryLink({
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

export function ToolCard({ tool, search, unseen, onMarkSeen }: ToolCardProps) {
  const markSeen = () => onMarkSeen(tool.slug)
  const sourceLabel =
    tool.channelCount === 1 ? "1 source" : `${tool.channelCount} sources`

  return (
    <article className="ledger-row" data-unseen={unseen || undefined}>
      <span className="ledger-row-marker">
        {unseen ? (
          <span
            className="ledger-unseen-dot"
            role="img"
            aria-label="New since your last visit"
          />
        ) : null}
      </span>

      <div className="ledger-row-copy">
        <p className="ledger-entry-kind">{formatTechnologyKind(tool.kind)}</p>

        <EntryLink
          tool={tool}
          search={search}
          className="ledger-row-title"
          onOpen={markSeen}
        >
          <h3>{tool.name}</h3>
        </EntryLink>

        <p className="ledger-entry-description">{tool.descriptionEn}</p>

        <Link
          to={`/tools/${tool.slug}`}
          state={{ from: search }}
          className="ledger-row-source"
          aria-label={`View ${tool.name} provenance`}
          onClick={markSeen}
        >
          <TelegramIcon size={11} />
          {sourceLabel}
        </Link>
      </div>

      <div className="ledger-row-meta">
        {tool.githubStars === null ? null : (
          <p
            className="ledger-stars"
            title={`${exactCountFormatter.format(tool.githubStars)} GitHub stars`}
            aria-label={`${exactCountFormatter.format(
              tool.githubStars
            )} GitHub stars`}
          >
            <span aria-hidden="true">★</span>
            {compactCountFormatter.format(tool.githubStars)}
          </p>
        )}
        <p className="ledger-row-date">
          <time dateTime={tool.firstMentionedAt}>
            {formatLedgerDate(tool.firstMentionedAt)}
          </time>
        </p>
      </div>
    </article>
  )
}
