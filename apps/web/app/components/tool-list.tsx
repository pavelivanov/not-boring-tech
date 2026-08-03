import type { Tool } from "@techdex/contracts"
import { SearchXIcon } from "lucide-react"
import { useEffect, useState } from "react"

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

type ToolListProps = {
  readonly tools: readonly Tool[]
  readonly search: string
  readonly onClear: () => void
}

const savedToolsStorageKey = "techdex:saved:v1"

function readSavedTools(): Set<string> {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(savedToolsStorageKey) ?? "[]"
    )

    return new Set(
      Array.isArray(saved)
        ? saved.filter((value): value is string => typeof value === "string")
        : []
    )
  } catch {
    return new Set()
  }
}

export function ToolList({ tools, search, onClear }: ToolListProps) {
  const [savedTools, setSavedTools] = useState<ReadonlySet<string>>(
    () => new Set()
  )

  useEffect(() => {
    setSavedTools(readSavedTools())
  }, [])

  function toggleSaved(slug: string) {
    setSavedTools((currentSavedTools) => {
      const nextSavedTools = new Set(currentSavedTools)

      if (nextSavedTools.has(slug)) {
        nextSavedTools.delete(slug)
      } else {
        nextSavedTools.add(slug)
      }

      try {
        window.localStorage.setItem(
          savedToolsStorageKey,
          JSON.stringify([...nextSavedTools])
        )
      } catch {
        // Saving remains useful for the session when storage is unavailable.
      }

      return nextSavedTools
    })
  }

  if (tools.length === 0) {
    return (
      <Empty className="tool-empty-state">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No entries match this combination</EmptyTitle>
          <EmptyDescription>
            Adjust the query, type, or tags—or clear everything and begin again.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onClear}>Clear filters</Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="tool-grid" aria-live="polite">
      {tools.map((tool) => (
        <ToolCard
          key={tool.slug}
          tool={tool}
          search={search}
          saved={savedTools.has(tool.slug)}
          onToggleSaved={toggleSaved}
        />
      ))}
    </div>
  )
}
