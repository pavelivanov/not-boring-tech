import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  MessageCircleMoreIcon,
} from "lucide-react"
import { Link, useLocation, useParams } from "react-router"

import { RelativeDate } from "~/components/relative-date"
import { Badge } from "~/components/ui/badge"
import { Separator } from "~/components/ui/separator"
import { channelsById } from "~/data/channels"
import { toolsBySlug } from "~/data/tools"
import { formatAbsoluteDate } from "~/domain/dates"
import {
  distinctChannelCount,
  firstPresentation,
  newestMentionsFirst,
} from "~/domain/tools"
import { canonicalMeta } from "~/domain/urls"

export function meta({ params }: { params: { slug?: string } }) {
  const tool = params.slug ? toolsBySlug.get(params.slug) : undefined

  if (!tool) {
    return [
      { title: "Tool not found · TechDex" },
      {
        name: "description",
        content: "The requested tool is not in the TechDex index.",
      },
    ]
  }

  return [
    { title: `${tool.name} · TechDex` },
    { name: "description", content: tool.description },
    ...canonicalMeta(`/tools/${tool.slug}`),
  ]
}

export default function ToolDetail() {
  const { slug } = useParams()
  const location = useLocation()
  const tool = slug ? toolsBySlug.get(slug) : undefined
  const originState = location.state as { from?: unknown } | null
  const originSearch =
    typeof originState?.from === "string" && originState.from.startsWith("?")
      ? originState.from
      : ""
  const backTarget = `/${originSearch}`

  if (!tool) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="page-width flex min-h-[65svh] flex-col justify-center py-16"
      >
        <p className="font-mono text-sm text-muted-foreground">
          Unknown tool / {slug ?? "missing-slug"}
        </p>
        <h1 className="mt-4 max-w-3xl font-heading text-5xl font-semibold tracking-[-0.05em] md:text-7xl">
          This tool is not in the index.
        </h1>
        <Link
          to="/"
          className="mt-8 inline-flex w-fit items-center gap-1.5 font-medium underline decoration-primary decoration-2 underline-offset-4"
        >
          <ArrowLeftIcon aria-hidden="true" />
          Return to search
        </Link>
      </main>
    )
  }

  const firstMention = firstPresentation(tool)
  const channelCount = distinctChannelCount(tool)
  const mentions = newestMentionsFirst(tool.mentions)

  return (
    <main id="main-content" tabIndex={-1} className="page-width py-12 md:py-20">
      <Link
        to={backTarget}
        className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-primary"
      >
        <ArrowLeftIcon aria-hidden="true" />
        Back to {originSearch ? "results" : "search"}
      </Link>

      <header className="mt-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{tool.category}</Badge>
            {tool.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="mt-5 font-heading text-5xl font-semibold tracking-[-0.05em] md:text-7xl">
            {tool.name}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {tool.description}
          </p>
        </div>

        <a
          href={tool.canonicalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-fit items-center gap-1.5 font-medium underline decoration-primary decoration-2 underline-offset-4 md:justify-self-end"
        >
          Visit tool
          <ArrowUpRightIcon aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </header>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-y py-5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDaysIcon aria-hidden="true" />
          First presented {formatAbsoluteDate(firstMention.publishedAt)} ·{" "}
          <RelativeDate value={firstMention.publishedAt} />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageCircleMoreIcon aria-hidden="true" />
          {channelCount} {channelCount === 1 ? "channel" : "channels"} ·{" "}
          {tool.mentions.length}{" "}
          {tool.mentions.length === 1 ? "mention" : "mentions"}
        </span>
      </div>

      <section className="mt-14" aria-labelledby="mentions-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Provenance
            </p>
            <h2
              id="mentions-heading"
              className="mt-2 text-3xl font-semibold tracking-tight"
            >
              Every presentation
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">Newest source first</p>
        </div>

        <div className="mt-6">
          {mentions.map((mention, index) => {
            const channel = channelsById.get(mention.channelId)

            return (
              <div key={mention.sourceUrl}>
                {index > 0 ? <Separator /> : null}
                <article className="grid gap-4 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div>
                    <h3 className="text-lg font-medium">
                      {channel?.name ?? mention.channelId}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatAbsoluteDate(mention.publishedAt)} ·{" "}
                      <RelativeDate value={mention.publishedAt} />
                    </p>
                  </div>
                  <a
                    href={mention.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-primary sm:justify-self-end"
                  >
                    Open Telegram source
                    <ArrowUpRightIcon aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </article>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
