import type { CatalogListItem } from "@findthatproject/contracts"
import { SearchIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { EntryLink } from "~/components/tool-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { normalizeSearchText } from "~/domain/search"
import { formatTechnologyKind } from "~/domain/tools"

const maxResults = 7
const maxSuggestions = 5

type IndexSearchDialogProps = {
  readonly entries: readonly CatalogListItem[]
  readonly suggestions: readonly CatalogListItem[]
  readonly query: string
  readonly search: string
  readonly onSubmitQuery: (query: string) => void
  readonly onOpenEntry: (slug: string) => void
}

function matches(entry: CatalogListItem, needle: string): boolean {
  return normalizeSearchText(
    `${entry.name} ${entry.kind} ${entry.descriptionEn} ${entry.tags.join(" ")}`
  ).includes(needle)
}

export function IndexSearchDialog({
  entries,
  suggestions,
  query,
  search,
  onSubmitQuery,
  onOpenEntry,
}: IndexSearchDialogProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(query)

  useEffect(() => {
    setDraft(query)
  }, [query])

  useEffect(() => {
    function openOnSlash(event: KeyboardEvent) {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      event.preventDefault()
      setOpen(true)
    }

    window.addEventListener("keydown", openOnSlash)
    return () => window.removeEventListener("keydown", openOnSlash)
  }, [])

  const needle = normalizeSearchText(draft)
  // Typing filters the entries already loaded so the list reacts on every
  // keystroke; Enter hands the query to the API for the whole index.
  const results = useMemo(
    () =>
      needle
        ? entries.filter((entry) => matches(entry, needle)).slice(0, maxResults)
        : suggestions.slice(0, maxSuggestions),
    [entries, needle, suggestions]
  )

  function submit() {
    onSubmitQuery(draft)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="index-search-trigger">
        <SearchIcon aria-hidden="true" />
        Search
        <kbd aria-hidden="true">/</kbd>
      </DialogTrigger>

      <DialogContent
        className="index-search-dialog"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Search the index</DialogTitle>

        <form
          className="index-search-field"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <SearchIcon aria-hidden="true" />
          <input
            type="search"
            autoFocus
            value={draft}
            aria-label="Search index"
            placeholder="Search the index"
            onChange={(event) => setDraft(event.target.value)}
          />
          <span className="index-search-hint" aria-hidden="true">
            Esc
          </span>
        </form>

        <div className="index-search-results">
          {results.length > 0 ? (
            <ul>
              {results.map((entry) => (
                <li key={entry.slug}>
                  <EntryLink
                    tool={entry}
                    search={search}
                    className="index-search-result"
                    onOpen={() => {
                      onOpenEntry(entry.slug)
                      setOpen(false)
                    }}
                  >
                    <span>{entry.name}</span>
                    <span className="ledger-entry-kind">
                      {formatTechnologyKind(entry.kind)}
                    </span>
                  </EntryLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="index-search-empty">No loaded entry matches that.</p>
          )}

          {needle ? (
            <button
              type="button"
              className="index-search-submit"
              onClick={submit}
            >
              Search the whole index for “{draft.trim()}”
            </button>
          ) : (
            <DialogDescription className="index-search-footnote">
              {suggestions.length > 0
                ? "Newest entries since your last visit. Type to filter, press Enter to search the whole index."
                : "Type to filter what is loaded, press Enter to search the whole index."}
            </DialogDescription>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
