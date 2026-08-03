import type { TechnologyKind, Tool } from "@techdex/contracts"

import { distinctChannelCount } from "./tools"

const relevance = {
  exactName: 10_000,
  name: 1_000,
  tag: 100,
  category: 10,
  description: 1,
} as const

export type SearchFilters = {
  readonly query: string
  readonly kind?: TechnologyKind
  readonly category?: string
  readonly channelId?: string
  readonly tags: readonly string[]
}

export type SearchStateOptions = {
  readonly kinds: readonly TechnologyKind[]
  readonly categories: readonly string[]
  readonly channelIds: readonly string[]
  readonly tags: readonly string[]
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/\s+/gu, " ")
    .trim()
}

function normalizedWords(value: string): readonly string[] {
  return normalizeSearchText(value).split(" ").filter(Boolean)
}

function scoreTextQuery(tool: Tool, query: string): number | null {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return 0
  }

  const name = normalizeSearchText(tool.name)
  const nameWords = new Set(normalizedWords(tool.name))
  const normalizedTags = tool.tags.map(normalizeSearchText)
  const category = normalizeSearchText(tool.category)
  const descriptionWords = new Set(normalizedWords(tool.description))

  if (name === normalizedQuery) {
    return relevance.exactName
  }

  const queryWords = normalizedWords(normalizedQuery)
  let total = 0

  for (const word of queryWords) {
    if (name.startsWith(word) || nameWords.has(word)) {
      total += relevance.name
      continue
    }

    if (
      normalizedTags.some(
        (tag) => tag === word || normalizedWords(tag).includes(word)
      )
    ) {
      total += relevance.tag
      continue
    }

    if (normalizedWords(category).includes(word)) {
      total += relevance.category
      continue
    }

    if (descriptionWords.has(word)) {
      total += relevance.description
      continue
    }

    return null
  }

  return total
}

export function searchTools(
  corpus: readonly Tool[],
  filters: SearchFilters
): readonly Tool[] {
  const selectedCategory = filters.category
    ? normalizeSearchText(filters.category)
    : undefined
  const selectedTags = new Set(filters.tags.map(normalizeSearchText))
  const scored: Array<{ tool: Tool; score: number }> = []

  for (const tool of corpus) {
    if (filters.kind && tool.kind !== filters.kind) {
      continue
    }

    if (
      filters.channelId &&
      !tool.mentions.some((mention) => mention.channelId === filters.channelId)
    ) {
      continue
    }

    if (
      selectedCategory &&
      normalizeSearchText(tool.category) !== selectedCategory
    ) {
      continue
    }

    if (
      selectedTags.size > 0 &&
      !tool.tags.some((tag) => selectedTags.has(normalizeSearchText(tag)))
    ) {
      continue
    }

    const score = scoreTextQuery(tool, filters.query)

    if (score !== null) {
      scored.push({ tool, score })
    }
  }

  return scored
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      const channelDifference =
        distinctChannelCount(right.tool) - distinctChannelCount(left.tool)

      if (channelDifference !== 0) {
        return channelDifference
      }

      return left.tool.name.localeCompare(right.tool.name)
    })
    .map(({ tool }) => tool)
}

export function parseSearchParams(
  params: URLSearchParams,
  options: SearchStateOptions
): SearchFilters {
  const validKinds = new Map(
    options.kinds.map((kind) => [normalizeSearchText(kind), kind])
  )
  const validCategories = new Map(
    options.categories.map((category) => [
      normalizeSearchText(category),
      category,
    ])
  )
  const validTags = new Map(
    options.tags.map((tag) => [normalizeSearchText(tag), tag])
  )
  const validChannels = new Map(
    options.channelIds.map((channelId) => [
      normalizeSearchText(channelId),
      channelId,
    ])
  )
  const categoryValue = params.get("category")
  const category = categoryValue
    ? validCategories.get(normalizeSearchText(categoryValue))
    : undefined
  const tags = [
    ...new Set(
      params
        .getAll("tag")
        .map((tag) => validTags.get(normalizeSearchText(tag)))
        .filter((tag): tag is string => Boolean(tag))
    ),
  ]
  const channelValue = params.get("channel")
  const channelId = channelValue
    ? validChannels.get(normalizeSearchText(channelValue))
    : undefined
  const kindValue = params.get("type")
  const kind = kindValue
    ? validKinds.get(normalizeSearchText(kindValue))
    : undefined
  const query = params.get("q")?.replace(/\s+/gu, " ").trim() ?? ""

  return {
    query,
    ...(kind ? { kind } : {}),
    ...(category ? { category } : {}),
    ...(channelId ? { channelId } : {}),
    tags,
  }
}

export function serializeSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams()

  const query = filters.query.replace(/\s+/gu, " ").trim()

  if (query) {
    params.set("q", query)
  }

  if (filters.kind) {
    params.set("type", filters.kind)
  }

  if (filters.category) {
    params.set("category", filters.category)
  }

  if (filters.channelId) {
    params.set("channel", filters.channelId)
  }

  for (const tag of [...new Set(filters.tags)].sort((left, right) =>
    left.localeCompare(right)
  )) {
    params.append("tag", tag)
  }

  return params
}
