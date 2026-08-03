import type {
  CatalogActiveFilters,
  CatalogSort,
  TechnologyKind,
} from "@techdex/contracts"

export type SearchFilters = {
  readonly query: string
  readonly kind?: TechnologyKind
  readonly category?: string
  readonly channel?: string
  readonly tags: readonly string[]
  readonly sort: CatalogSort
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/\s+/gu, " ")
    .trim()
}

export function filtersFromActive(
  filters: CatalogActiveFilters
): SearchFilters {
  return {
    query: filters.q,
    ...(filters.kind[0] ? { kind: filters.kind[0] } : {}),
    ...(filters.category[0] ? { category: filters.category[0] } : {}),
    ...(filters.channel[0] ? { channel: filters.channel[0] } : {}),
    tags: filters.tag,
    sort: filters.sort,
  }
}

export function serializeSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams()
  const query = filters.query.replace(/\s+/gu, " ").trim()

  if (query) params.set("q", query)
  if (filters.kind) params.set("kind", filters.kind)
  if (filters.category) params.set("category", filters.category)
  if (filters.channel) params.set("channel", filters.channel)
  for (const tag of [...new Set(filters.tags)].sort((left, right) =>
    left.localeCompare(right)
  )) {
    params.append("tag", tag)
  }
  if (filters.sort !== "latest") params.set("sort", filters.sort)
  return params
}
