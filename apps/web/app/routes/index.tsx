import type { Route } from "./+types/index"
import { CatalogHydrateFallback, CatalogSurface, ErrorBoundary } from "./home"
import { loadHomeCatalog } from "~/data/api-client"
import { canonicalMeta } from "~/domain/urls"

export function meta() {
  return [
    { title: "Full Index · FindThatProject" },
    {
      name: "description",
      content:
        "Browse and filter the complete FindThatProject technology index.",
    },
    ...canonicalMeta("/index"),
  ]
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url)
  const requestedSort = url.searchParams.get("sort")

  // Traction is the full index's default view. Put that order on the API query
  // so pagination operates over the globally highest-starred entries instead
  // of reordering only the latest page in the browser.
  if (requestedSort !== "latest" && requestedSort !== "stars") {
    url.searchParams.set("sort", "stars")
  }

  return loadHomeCatalog(url.href, request.signal)
}
clientLoader.hydrate = true as const

export default function Index({ loaderData }: Route.ComponentProps) {
  return <CatalogSurface data={loaderData} mode="index" />
}

export function HydrateFallback() {
  return <CatalogHydrateFallback mode="index" />
}

export { ErrorBoundary }
