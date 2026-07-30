import { ArrowLeftIcon } from "lucide-react"
import { Link } from "react-router"

import { Separator } from "~/components/ui/separator"
import { canonicalMeta } from "~/domain/urls"

export function meta() {
  return [
    { title: "About · TechDex" },
    {
      name: "description",
      content:
        "How TechDex defines its Telegram corpus, attribution, and read-only public index.",
    },
    ...canonicalMeta("/about"),
  ]
}

export default function About() {
  return (
    <main id="main-content" className="page-width py-12 md:py-20">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-primary"
      >
        <ArrowLeftIcon aria-hidden="true" />
        Back to search
      </Link>

      <header className="mt-10 max-w-3xl">
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          About the index
        </p>
        <h1 className="mt-4 font-heading text-5xl font-semibold tracking-[-0.05em] md:text-7xl">
          The stream already did the curation.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          TechDex turns a bounded set of trusted public Telegram channels into a
          searchable index. It is designed for finding a useful tool again—not
          for manufacturing another discovery feed.
        </p>
      </header>

      <Separator className="my-12" />

      <div className="grid gap-10 md:grid-cols-2 md:gap-16">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Corpus boundary</h2>
          <p className="leading-relaxed text-muted-foreground">
            Only posts from an owner-approved set of public technology channels
            belong in the index. Private chats, user-selected channels, ads, job
            posts, and copied full post bodies are outside the boundary.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Attribution</h2>
          <p className="leading-relaxed text-muted-foreground">
            Each presentation keeps its original channel, publication date, and
            direct public post link. Tool descriptions are short English
            summaries rather than reproductions of channel text.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Read-only by design</h2>
          <p className="leading-relaxed text-muted-foreground">
            Visitors can search and follow sources, but cannot create, edit, or
            delete records. Updates are handled by controlled collection and
            maintenance tooling outside the public website.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Corrections and removals</h2>
          <p className="leading-relaxed text-muted-foreground">
            During the prototype, contact the owner who shared this index to
            request a correction or removal. A public handling destination will
            be listed here before launch; no unmonitored form is presented as a
            working support channel.
          </p>
        </section>
      </div>
    </main>
  )
}
