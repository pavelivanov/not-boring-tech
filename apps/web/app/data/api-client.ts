import {
  apiErrorResponseSchema,
  catalogChannelsResponseSchema,
  catalogDetailResponseSchema,
  catalogFacetsResponseSchema,
  catalogListResponseSchema,
  type CatalogActiveFilters,
  type CatalogChannelsResponse,
  type CatalogDetailResponse,
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

export const loadHomeCatalog = async (
  pageUrl: string,
  signal?: AbortSignal,
  options: ApiClientOptions = {}
): Promise<HomeCatalogData> => {
  const params = listParamsFromPageUrl(pageUrl)
  const query = params.size > 0 ? `?${params.toString()}` : ""
  const [catalog, facets, channels] = await Promise.all([
    requestJson(
      `v1/catalog${query}`,
      catalogListResponseSchema,
      signal,
      options
    ),
    requestJson("v1/facets", catalogFacetsResponseSchema, signal, options),
    requestJson("v1/channels", catalogChannelsResponseSchema, signal, options),
  ])
  return { catalog, facets, channels }
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

export const loadCatalogDetail = async (
  slug: string,
  signal?: AbortSignal,
  options: ApiClientOptions = {}
): Promise<CatalogDetailResponse | null> => {
  try {
    return await requestJson(
      `v1/catalog/${encodeURIComponent(slug)}`,
      catalogDetailResponseSchema,
      signal,
      options
    )
  } catch (error) {
    if (error instanceof CatalogApiError && error.status === 404) return null
    throw error
  }
}
