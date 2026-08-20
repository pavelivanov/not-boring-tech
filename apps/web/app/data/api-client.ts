import {
  apiErrorResponseSchema,
  catalogChannelsResponseSchema,
  catalogFacetsResponseSchema,
  catalogListResponseSchema,
  type CatalogActiveFilters,
  type CatalogChannelsResponse,
  type CatalogFacetsResponse,
  type CatalogListResponse,
} from "@findthatproject/contracts"

const API_QUERY_KEYS = [
  "q",
  "kind",
  "category",
  "channel",
  "tag",
  "sort",
] as const

export class CatalogApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null

  constructor(status: number, code: string, requestId: string | null = null) {
    super(code)
    this.name = "CatalogApiError"
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

interface ApiClientOptions {
  readonly baseUrl?: string
  readonly fetcher?: typeof fetch
}

interface ResponseSchema<Output> {
  safeParse(
    input: unknown
  ):
    | { readonly success: true; readonly data: Output }
    | { readonly success: false }
}

const resolveBaseUrl = (explicitBaseUrl?: string): URL => {
  const value = explicitBaseUrl ?? import.meta.env.VITE_API_BASE_URL
  if (!value) throw new CatalogApiError(0, "API_NOT_CONFIGURED")
  try {
    const url = new URL(value)
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error("invalid API URL")
    }
    return new URL(url.href.endsWith("/") ? url.href : `${url.href}/`)
  } catch {
    throw new CatalogApiError(0, "API_NOT_CONFIGURED")
  }
}

const requestJson = async <Output>(
  path: string,
  schema: ResponseSchema<Output>,
  signal: AbortSignal | undefined,
  options: ApiClientOptions
): Promise<Output> => {
  const url = new URL(path.replace(/^\//u, ""), resolveBaseUrl(options.baseUrl))
  const requestInit: RequestInit = {
    method: "GET",
    headers: { Accept: "application/json" },
    ...(signal ? { signal } : {}),
  }
  const response = await (options.fetcher ?? fetch)(url, requestInit)
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new CatalogApiError(response.status, "API_INVALID_RESPONSE")
  }
  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(payload)
    throw new CatalogApiError(
      response.status,
      parsedError.success ? parsedError.data.error.code : "API_REQUEST_FAILED",
      parsedError.success ? parsedError.data.error.requestId : null
    )
  }
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new CatalogApiError(response.status, "API_INVALID_RESPONSE")
  }
  return parsed.data
}

const listParamsFromPageUrl = (pageUrl: string): URLSearchParams => {
  const pageParams = new URL(pageUrl).searchParams
  const apiParams = new URLSearchParams()
  for (const key of API_QUERY_KEYS) {
    for (const value of pageParams.getAll(key)) apiParams.append(key, value)
  }
  return apiParams
}

const listParamsFromFilters = (
  filters: CatalogActiveFilters,
  cursor: string
): URLSearchParams => {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  for (const value of filters.kind) params.append("kind", value)
  for (const value of filters.category) params.append("category", value)
  for (const value of filters.channel) params.append("channel", value)
  for (const value of filters.tag) params.append("tag", value)
  params.set("sort", filters.sort)
  params.set("limit", String(filters.limit))
  params.set("cursor", cursor)
  return params
}

export interface HomeCatalogData {
  readonly catalog: CatalogListResponse
  readonly facets: CatalogFacetsResponse
  readonly channels: CatalogChannelsResponse
}

type HomeCatalogMetadata = Pick<HomeCatalogData, "facets" | "channels">

type MetadataCacheEntry = {
  readonly expiresAt: number
  readonly value: HomeCatalogMetadata
}

const HOME_METADATA_CACHE_TTL_MS = 5 * 60 * 1_000
const homeMetadataCache = new WeakMap<
  typeof fetch,
  Map<string, MetadataCacheEntry>
>()

const loadHomeMetadata = async (
  signal: AbortSignal | undefined,
  options: ApiClientOptions
): Promise<HomeCatalogMetadata> => {
  const fetcher = options.fetcher ?? fetch
  const baseUrl = resolveBaseUrl(options.baseUrl).href
  const fetcherCache = homeMetadataCache.get(fetcher)
  const cached = fetcherCache?.get(baseUrl)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const requestOptions = { ...options, baseUrl, fetcher }
  const [facets, channels] = await Promise.all([
    requestJson(
      "v1/facets",
      catalogFacetsResponseSchema,
      signal,
      requestOptions
    ),
    requestJson(
      "v1/channels",
      catalogChannelsResponseSchema,
      signal,
      requestOptions
    ),
  ])
  const value = { facets, channels }
  const nextFetcherCache = fetcherCache ?? new Map<string, MetadataCacheEntry>()
  nextFetcherCache.set(baseUrl, {
    expiresAt: Date.now() + HOME_METADATA_CACHE_TTL_MS,
    value,
  })
  if (!fetcherCache) homeMetadataCache.set(fetcher, nextFetcherCache)
  return value
}

export const loadHomeCatalog = async (
  pageUrl: string,
  signal?: AbortSignal,
  options: ApiClientOptions = {}
): Promise<HomeCatalogData> => {
  const params = listParamsFromPageUrl(pageUrl)
  const query = params.size > 0 ? `?${params.toString()}` : ""
  const [catalog, metadata] = await Promise.all([
    requestJson(
      `v1/catalog${query}`,
      catalogListResponseSchema,
      signal,
      options
    ),
    loadHomeMetadata(signal, options),
  ])
  return { catalog, ...metadata }
}

export const loadNextCatalogPage = (
  filters: CatalogActiveFilters,
  cursor: string,
  signal?: AbortSignal,
  options: ApiClientOptions = {}
): Promise<CatalogListResponse> =>
  requestJson(
    `v1/catalog?${listParamsFromFilters(filters, cursor).toString()}`,
    catalogListResponseSchema,
    signal,
    options
  )
