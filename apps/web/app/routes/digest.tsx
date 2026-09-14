import { ArrowLeftIcon, StarIcon } from "lucide-react"
import { Link } from "react-router"

import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { loadDigestRun } from "~/data/api-client"
import { formatLedgerDate } from "~/domain/dates"
import { formatTechnologyKind } from "~/domain/tools"
import { canonicalMeta } from "~/domain/urls"
import { useLocale } from "~/lib/locale"
import type { DigestItem } from "@findthatproject/contracts"

import type { Route } from "./+types/digest"

interface DigestCopy {
  readonly back: string
  readonly eyebrow: string
  readonly title: string
  readonly featured: string
  readonly more: string
  readonly addedAt: string
}

const COPY: Record<"en" | "ru", DigestCopy> = {
  en: {
    back: "Back to new items",
    eyebrow: "Weekly digest",
    title: "This week in tech",
    featured: "Featured in the Telegram post",
    more: "More from this week",
    addedAt: "Added",
  },
  ru: {
    back: "К новым поступлениям",
    eyebrow: "Недельная подборка",
    title: "Неделя в технологиях",
    featured: "Вошли в пост в Telegram",
    more: "Ещё на этой неделе",
    addedAt: "Добавлено",
  },
}

export function meta() {
  return [
    { title: "Weekly Digest · FindThatProject" },
    {
      name: "description",
      content:
        "The complete item list behind this week's FindThatProject Telegram digest.",
    },
    ...canonicalMeta("/digest/latest"),
  ]
}

export async function clientLoader({
  params,
  request,
}: Route.ClientLoaderArgs) {
  return loadDigestRun(params.id ?? "latest", request.signal)
}
clientLoader.hydrate = true as const

function HydrateFallback() {
  return (
    <main id="main-content" tabIndex={-1} className="page-width py-12 md:py-20">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-10 h-16 w-full max-w-xl" />
      <Skeleton className="mt-6 h-5 w-96" />
      <div className="mt-12 grid gap-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    </main>
  )
}

function DigestItemCard({
  item,
  locale,
  copy,
  featured,
}: {
  readonly item: DigestItem
  readonly locale: "en" | "ru"
  readonly copy: DigestCopy
  readonly featured: boolean
}) {
  const name = locale === "ru" ? item.nameRu : item.name
  const description = locale === "ru" ? item.descriptionRu : item.descriptionEn
  const mainUrl = item.canonicalUrl ?? item.githubUrl

  return (
    <article
      className="rounded-lg border bg-card p-5"
      data-featured={featured ? true : undefined}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold tracking-tight">
          {mainUrl ? (
            <a
              href={mainUrl}
              className="hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {name}
            </a>
          ) : (
            name
          )}
        </h3>
        <span className="font-mono text-xs tracking-[0.15em] text-muted-foreground uppercase">
          {formatTechnologyKind(item.kind, locale)}
        </span>
        {item.githubStars !== null ? (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <StarIcon aria-hidden="true" className="size-3.5" />
            {new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(
              item.githubStars
            )}
          </span>
        ) : null}
      </div>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        {description}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {copy.addedAt} {formatLedgerDate(item.catalogCreatedAt, locale)}
        {item.githubUrl && mainUrl !== item.githubUrl ? (
          <>
            {" · "}
            <a
              href={item.githubUrl}
              className="underline underline-offset-4 hover:decoration-primary"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </>
        ) : null}
      </p>
    </article>
  )
}

export default function Digest({ loaderData }: Route.ComponentProps) {
  const { locale } = useLocale()
  const copy = COPY[locale]
  const selectedCount = loaderData.selectedCount
  const featured = loaderData.items.filter(
    (item) => item.ordinal < selectedCount
  )
  const overflow = loaderData.items.filter(
    (item) => item.ordinal >= selectedCount
  )

  return (
    <main id="main-content" tabIndex={-1} className="page-width py-12 md:py-20">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-primary"
      >
        <ArrowLeftIcon aria-hidden="true" />
        {copy.back}
      </Link>

      <header className="mt-10 max-w-3xl">
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          {copy.eyebrow}
        </p>
        <h1 className="mt-4 font-heading text-5xl font-semibold tracking-[-0.05em] md:text-7xl">
          {copy.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {formatLedgerDate(loaderData.windowStart, locale)} —{" "}
          {formatLedgerDate(loaderData.windowEnd, locale)} ·{" "}
          {new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(
            loaderData.itemCount
          )}
        </p>
      </header>

      <Separator className="my-12" />

      {featured.length > 0 ? (
        <section aria-labelledby="digest-featured" className="mb-12">
          <h2
            id="digest-featured"
            className="mb-4 text-xl font-semibold tracking-tight"
          >
            {copy.featured}
          </h2>
          <div className="grid gap-4">
            {featured.map((item) => (
              <DigestItemCard
                key={item.ordinal}
                item={item}
                locale={locale}
                copy={copy}
                featured
              />
            ))}
          </div>
        </section>
      ) : null}

      {overflow.length > 0 ? (
        <section aria-labelledby="digest-overflow">
          <h2
            id="digest-overflow"
            className="mb-4 text-xl font-semibold tracking-tight"
          >
            {copy.more}
          </h2>
          <div className="grid gap-4">
            {overflow.map((item) => (
              <DigestItemCard
                key={item.ordinal}
                item={item}
                locale={locale}
                copy={copy}
                featured={false}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}

export { HydrateFallback }
