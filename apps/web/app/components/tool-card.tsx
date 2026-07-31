import type { Tool } from "@techdex/contracts"
import {
  ArrowUpRightIcon,
  Layers2Icon,
  MessageCircleMoreIcon,
} from "lucide-react"
import { Link } from "react-router"

import { RelativeDate } from "~/components/relative-date"
import { Badge } from "~/components/ui/badge"
import { channelsById } from "~/data/channels"
import { firstPresentation, formatTechnologyKind } from "~/domain/tools"

type ToolCardProps = {
  readonly tool: Tool
  readonly resultNumber: number
  readonly search: string
}

function hostLabel(value: string): string {
  return new URL(value).hostname.replace(/^www\./u, "")
}

function channelHandle(publicUrl: string): string {
  return `@${new URL(publicUrl).pathname.replace(/^\//u, "")}`
}

function channelFilterPath(search: string, channelId: string): string {
  const params = new URLSearchParams(search)

  params.delete("q")
  params.set("channel", channelId)

  return `/?${params.toString()}`
}

export function ToolCard({ tool, resultNumber, search }: ToolCardProps) {
  const firstMention = firstPresentation(tool)
  const sourceChannels = [
    ...new Set(tool.mentions.map((mention) => mention.channelId)),
  ].flatMap((channelId) => {
    const channel = channelsById.get(channelId)

    return channel ? [channel] : []
  })

  return (
    <article className="tool-result grid gap-5 py-7 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:py-9">
      <p
        className="font-mono text-xs text-muted-foreground"
        aria-label={`Result ${resultNumber}`}
      >
        {String(resultNumber).padStart(2, "0")}
      </p>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{formatTechnologyKind(tool.kind)}</Badge>
            <Badge variant="outline">{tool.category}</Badge>
            {tool.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            <Link
              to={`/tools/${tool.slug}`}
              state={{ from: search }}
              className="decoration-primary decoration-2 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {tool.name}
            </Link>
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {tool.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span>
            Presented <RelativeDate value={firstMention.publishedAt} />
          </span>
          <span
            className="flex flex-wrap items-center gap-1.5"
            aria-label="Source channels"
          >
            <MessageCircleMoreIcon aria-hidden="true" />
            {sourceChannels.map((channel) => {
              const handle = channelHandle(channel.publicUrl)

              return (
                <Badge key={channel.id} variant="outline" asChild>
                  <Link
                    to={channelFilterPath(search, channel.id)}
                    aria-label={`Filter by source channel ${channel.name} (${handle})`}
                  >
                    {handle}
                  </Link>
                </Badge>
              )
            })}
          </span>
          <Link
            to={`/tools/${tool.slug}`}
            state={{ from: search }}
            className="inline-flex items-center gap-1.5 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-primary"
          >
            <Layers2Icon aria-hidden="true" />
            View provenance
          </Link>
        </div>
      </div>

      <a
        href={tool.canonicalUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-fit items-center gap-1.5 text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-primary md:justify-self-end"
      >
        {hostLabel(tool.canonicalUrl)}
        <ArrowUpRightIcon aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </article>
  )
}
