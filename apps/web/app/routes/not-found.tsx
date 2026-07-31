import { ArrowLeftIcon } from "lucide-react"
import { Link } from "react-router"

import { canonicalMeta } from "~/domain/urls"

export function meta() {
  return [
    { title: "Not found · TechDex" },
    {
      name: "description",
      content: "The requested TechDex page could not be found.",
    },
    ...canonicalMeta("/404"),
  ]
}

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="page-width flex min-h-[65svh] flex-col justify-center py-16"
    >
      <p className="font-mono text-sm text-muted-foreground">404 / no signal</p>
      <h1 className="mt-4 max-w-3xl font-heading text-5xl font-semibold tracking-[-0.05em] md:text-7xl">
        That page never made it into the index.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted-foreground">
        The address may be wrong, or the record may have been removed.
      </p>
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
