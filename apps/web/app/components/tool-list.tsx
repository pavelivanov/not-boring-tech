import type { Tool } from "@techdex/contracts"
import { SearchXIcon } from "lucide-react"

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
import { Separator } from "~/components/ui/separator"

type ToolListProps = {
  readonly tools: readonly Tool[]
  readonly search: string
  readonly onClear: () => void
}

export function ToolList({ tools, search, onClear }: ToolListProps) {
  if (tools.length === 0) {
    return (
      <Empty className="min-h-80 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No entries match this combination</EmptyTitle>
          <EmptyDescription>
            Adjust a source, category, or tag filter—or clear everything and
            begin again.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onClear}>Clear filters</Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div aria-live="polite">
      {tools.map((tool, index) => (
        <div key={tool.slug}>
          {index > 0 ? <Separator /> : null}
          <ToolCard tool={tool} resultNumber={index + 1} search={search} />
        </div>
      ))}
    </div>
  )
}
