import type { CatalogListItem } from "@findthatproject/contracts"
import type { ReactNode } from "react"

import { TelegramIcon } from "~/components/telegram-icon"
import { formatLedgerDate } from "~/domain/dates"
import { formatTechnologyKind, localizeCatalogItem } from "~/domain/tools"
import { useLocale } from "~/lib/locale"

type ToolCardProps = {
  readonly tool: CatalogListItem
  readonly unseen: boolean
  readonly onMarkSeen: (slug: string) => void
}

export type EntryLinkProps = {
  readonly tool: CatalogListItem
  readonly className: string
  readonly children: ReactNode
  readonly onOpen: () => void
}

const compactCountFormatters = {
  en: new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }),
  ru: new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }),
} as const

const exactCountFormatters = {
  en: new Intl.NumberFormat("en"),
  ru: new Intl.NumberFormat("ru-RU"),
} as const

export function EntryLink({
  tool,
  className,
  children,
  onOpen,
}: EntryLinkProps) {
  const { locale, copy } = useLocale()
  const content = localizeCatalogItem(tool, locale)

  return (
    <a
      href={tool.canonicalUrl ?? tool.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={className}
      aria-label={
        tool.canonicalUrl
          ? copy.toolCard.externalProject(content.name)
          : copy.toolCard.sourceLink(content.name)
      }
      onClick={onOpen}
    >
      {children}
    </a>
  )
}

export function ToolCard({ tool, unseen, onMarkSeen }: ToolCardProps) {
  const { locale, copy } = useLocale()
  const content = localizeCatalogItem(tool, locale)
  const markSeen = () => onMarkSeen(tool.slug)
  const exactStarCount =
    tool.githubStars === null
      ? null
      : exactCountFormatters[locale].format(tool.githubStars)

  return (
    <article className="ledger-row" data-unseen={unseen || undefined}>
      <span className="ledger-row-marker">
        {unseen ? (
          <span
            className="ledger-unseen-dot"
            role="img"
            aria-label={copy.toolCard.newSinceVisit}
          />
        ) : null}
      </span>

      <div className="ledger-row-copy">
        <p className="ledger-entry-kind">
          {formatTechnologyKind(tool.kind, locale)}
        </p>

        <EntryLink tool={tool} className="ledger-row-title" onOpen={markSeen}>
          <h3>{content.name}</h3>
        </EntryLink>

        <p className="ledger-entry-description">{content.description}</p>

        <a
          href={tool.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="ledger-row-source"
          aria-label={copy.toolCard.sourceLink(content.name)}
          onClick={markSeen}
        >
          <TelegramIcon size={11} />
          {copy.toolCard.source}
        </a>
      </div>

      <div className="ledger-row-meta">
        {tool.githubStars === null ? null : (
          <p
            className="ledger-stars"
            title={copy.toolCard.stars(exactStarCount ?? "")}
            aria-label={copy.toolCard.stars(exactStarCount ?? "")}
          >
            <span aria-hidden="true">★</span>
            {compactCountFormatters[locale].format(tool.githubStars)}
          </p>
        )}
        <p className="ledger-row-date">
          <time dateTime={tool.firstMentionedAt}>
            {formatLedgerDate(tool.firstMentionedAt, locale)}
          </time>
        </p>
      </div>
    </article>
  )
}
