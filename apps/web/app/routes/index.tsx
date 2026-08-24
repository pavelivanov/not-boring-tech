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
  return loadHomeCatalog(request.url, request.signal)
}
clientLoader.hydrate = true as const

export default function Index({ loaderData }: Route.ComponentProps) {
  return <CatalogSurface data={loaderData} mode="index" />
}

export function HydrateFallback() {
  return <CatalogHydrateFallback mode="index" />
}

export { ErrorBoundary }
