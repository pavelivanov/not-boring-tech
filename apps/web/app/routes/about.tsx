import { ArrowLeftIcon } from "lucide-react"
import { Link } from "react-router"

import { Separator } from "~/components/ui/separator"
import { canonicalMeta } from "~/domain/urls"
import { useLocale } from "~/lib/locale"

export function meta() {
  return [
    { title: "About · FindThatProject" },
    {
      name: "description",
      content:
        "How FindThatProject defines its Telegram corpus, attribution, and read-only public index.",
    },
    ...canonicalMeta("/about"),
  ]
}

export default function About() {
  const { copy } = useLocale()

  return (
    <main id="main-content" tabIndex={-1} className="page-width py-12 md:py-20">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-primary"
      >
        <ArrowLeftIcon aria-hidden="true" />
        {copy.about.back}
      </Link>

      <header className="mt-10 max-w-3xl">
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          {copy.about.eyebrow}
        </p>
        <h1 className="mt-4 font-heading text-5xl font-semibold tracking-[-0.05em] md:text-7xl">
          {copy.about.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {copy.about.intro}
        </p>
      </header>

      <Separator className="my-12" />

      <div className="grid gap-10 md:grid-cols-2 md:gap-16">
        {copy.about.sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </main>
  )
}
