import type { CatalogListItem } from "@findthatproject/contracts"
import { ArrowUpRightIcon } from "lucide-react"
import { useState } from "react"

import { EntryLink } from "~/components/tool-card"
import { Button } from "~/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { formatTechnologyKind } from "~/domain/tools"

type UnseenPanelProps = {
  readonly entries: readonly CatalogListItem[]
  readonly visitLabel: string
  readonly search: string
  readonly onMarkSeen: (slug: string) => void
  readonly onMarkAllSeen: () => void
  readonly onReset: () => void
  readonly onShowUnseen: () => void
}

export function UnseenPanel({
  entries,
  visitLabel,
  search,
  onMarkSeen,
  onMarkAllSeen,
  onReset,
  onShowUnseen,
}: UnseenPanelProps) {
  const [open, setOpen] = useState(false)
  const count = entries.length
  const hasUnseen = count > 0

  function closeAfter(action: () => void) {
    return () => {
      action()
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasUnseen ? "ink" : "outline"}
          size="pill"
          className="ledger-bell"
        >
          {hasUnseen ? (
            <span className="ledger-unseen-dot" aria-hidden="true" />
          ) : null}
          {hasUnseen ? `${count} new` : "Up to date"}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="ledger-unseen-panel"
        aria-label="Entries indexed since your last visit"
      >
        <div className="ledger-unseen-head">
          <p>{visitLabel}</p>
          {hasUnseen ? (
            <Button
              variant="link"
              size="sm"
              className="ledger-unseen-mark-all"
              onClick={closeAfter(onMarkAllSeen)}
            >
              Mark all seen
            </Button>
          ) : null}
        </div>

        {hasUnseen ? (
          <>
            <ul className="ledger-unseen-list">
              {entries.map((entry) => (
                <li key={entry.slug}>
                  <EntryLink
                    tool={entry}
                    search={search}
                    className="ledger-unseen-item"
                    onOpen={closeAfter(() => onMarkSeen(entry.slug))}
                  >
                    <span className="ledger-unseen-item-copy">
                      <span className="ledger-entry-kind">
                        <span
                          className="ledger-unseen-dot"
                          aria-hidden="true"
                        />
                        {formatTechnologyKind(entry.kind)}
                      </span>
                      <strong>{entry.name}</strong>
                      <small>{entry.descriptionEn}</small>
                    </span>
                    <ArrowUpRightIcon aria-hidden="true" />
                  </EntryLink>
                </li>
              ))}
            </ul>

            <div className="ledger-unseen-foot">
              <Button
                variant="ink"
                size="pill"
                className="w-full"
                onClick={closeAfter(onShowUnseen)}
              >
                Show all {count} in the index
              </Button>
            </div>
          </>
        ) : (
          <div className="ledger-unseen-caught-up">
            <h2>You’re up to date.</h2>
            <p>
              A few entries land every day.{" "}
              <a
                href="https://t.me/findthatproject"
                target="_blank"
                rel="noreferrer"
              >
                @findthatproject
              </a>{" "}
              announces each one; this counter collects them for your next
              visit.
            </p>
            <Button variant="outline" size="sm" onClick={closeAfter(onReset)}>
              Reset read state
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
