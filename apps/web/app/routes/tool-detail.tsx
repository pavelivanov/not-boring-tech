import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  MessageCircleMoreIcon,
  StarIcon,
} from "lucide-react"
import { Link, useLocation, useRevalidator } from "react-router"

import type { Route } from "./+types/tool-detail"
import { RelativeDate } from "~/components/relative-date"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { CatalogApiError, loadCatalogDetail } from "~/data/api-client"
import { formatAbsoluteDate } from "~/domain/dates"
import { formatTechnologyKind } from "~/domain/tools"
import { canonicalMeta } from "~/domain/urls"

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: "Technology subject · TechDex" },
    {
      name: "description",
      content: "A technology subject with Telegram source provenance.",
    },
    ...(params.slug ? canonicalMeta(`/tools/${params.slug}`) : []),
  ]
}

export async function clientLoader({
  params,
  request,
}: Route.ClientLoaderArgs) {
  const response = params.slug
    ? await loadCatalogDetail(params.slug, request.signal)
    : null

  return {
    item: response?.item ?? null,
  }
}
clientLoader.hydrate = true as const

function NotFound({ slug }: { readonly slug: string | undefined }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="page-width flex min-h-[65svh] flex-col justify-center py-16"
    >
      <p className="font-mono text-sm text-muted-foreground">
        Unknown subject / {slug ?? "missing-slug"}
      </p>
      <h1 className="mt-4 max-w-3xl font-heading text-5xl font-semibold tracking-[-0.05em] md:text-7xl">
        This subject is not in the index.
      </h1>
      <Link
        to="/"
        className="mt-8 inline-flex w-fit items-center gap-1.5 font-medium underline decoration-primary decoration-2 underline-offset-4"
      >
        <ArrowLeftIcon aria-hidden="true" />
        Return to index
      </Link>
    </main>
  )
}

export default function ToolDetail({
  loaderData,
  params,
}: Route.ComponentProps) {
  const location = useLocation()
  const item = loaderData.item
  const originState = location.state as { from?: unknown } | null
  const originSearch =
    typeof originState?.from === "string" && originState.from.startsWith("?")
      ? originState.from
      : ""
  const backTarget = `/${originSearch}`

  if (!item) return <NotFound slug={params.slug} />

  const kindLabel = formatTechnologyKind(item.kind)

  return (
    <main id="main-content" tabIndex={-1} className="page-width py-12 md:py-20">
      <Link
        to={backTarget}
        className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-primary"
      >
        <ArrowLeftIcon aria-hidden="true" />
        Back to {originSearch ? "filtered results" : "index"}
      </Link>

      <header className="mt-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{kindLabel}</Badge>
            <Badge variant="outline">{item.category}</Badge>
            {item.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="mt-5 font-heading text-5xl font-semibold tracking-[-0.05em] md:text-7xl">
            {item.name}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {item.descriptionEn}
          </p>
          {item.parentName ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Feature of{" "}
              <span className="font-medium text-foreground">
                {item.parentName}
              </span>
            </p>
          ) : null}
        </div>

        {item.canonicalUrl ? (
          <a
            href={item.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-fit items-center gap-1.5 font-medium underline decoration-primary decoration-2 underline-offset-4 md:justify-self-end"
          >
            Open {kindLabel.toLocaleLowerCase("en")}
            <ArrowUpRightIcon aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </header>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-y py-5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDaysIcon aria-hidden="true" />
          First presented {formatAbsoluteDate(item.firstMentionedAt)} ·{" "}
          <RelativeDate value={item.firstMentionedAt} />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageCircleMoreIcon aria-hidden="true" />
          {item.channelCount} {item.channelCount === 1 ? "channel" : "channels"}{" "}
          · {item.mentionCount}{" "}
          {item.mentionCount === 1 ? "mention" : "mentions"}
        </span>
        {item.githubStars !== null ? (
          <span className="inline-flex items-center gap-1.5">
            <StarIcon aria-hidden="true" />
            {item.githubStars.toLocaleString("en")} GitHub stars
          </span>
        ) : null}
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
          {item.mentions.map((mention, index) => (
            <div key={mention.sourceUrl}>
              {index > 0 ? <Separator /> : null}
              <article className="grid gap-4 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <h3 className="text-lg font-medium">
                    {mention.channelTitle ?? mention.channelHandle}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatAbsoluteDate(mention.publishedAt)} ·{" "}
                    <RelativeDate value={mention.publishedAt} /> ·{" "}
                    {Math.round(mention.confidence * 100)}% confidence
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
          ))}
        </div>
      </section>
    </main>
  )
}

export function HydrateFallback() {
  return (
    <main
      id="main-content"
      className="page-width flex min-h-[65svh] flex-col justify-center gap-5 py-16"
      aria-label="Loading catalog item"
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-16 w-2/3" />
      <Skeleton className="h-24 w-full max-w-3xl" />
      <Skeleton className="h-14 w-full" />
    </main>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const revalidator = useRevalidator()
  const requestId = error instanceof CatalogApiError ? error.requestId : null

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="page-width flex min-h-[65svh] items-center py-16"
    >
      <Alert variant="destructive" className="max-w-2xl">
        <AlertCircleIcon aria-hidden="true" />
        <AlertTitle>The subject could not be loaded</AlertTitle>
        <AlertDescription>
          Retry the live catalog request.
          {requestId ? ` Request ID: ${requestId}.` : ""}
        </AlertDescription>
        <AlertAction>
          <Button
            variant="outline"
            disabled={revalidator.state !== "idle"}
            onClick={() => revalidator.revalidate()}
          >
            {revalidator.state === "idle" ? "Retry" : "Retrying…"}
          </Button>
        </AlertAction>
      </Alert>
    </main>
  )
}
