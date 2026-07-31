import type { Mention, TechnologyKind, Tool } from "@techdex/contracts"

const kindLabels: Readonly<Record<TechnologyKind, string>> = {
  TOOL: "Tool",
  PROJECT: "Project",
  LIBRARY: "Library",
  SERVICE: "Service",
  PRODUCT: "Product",
  FEATURE: "Feature",
  PLUGIN: "Plugin",
  SKILL: "Skill",
  GUIDE: "Guide",
  CHEAT_SHEET: "Cheat sheet",
  PODCAST: "Podcast",
  OTHER_TECH: "Technology",
}

export function formatTechnologyKind(kind: TechnologyKind): string {
  return kindLabels[kind]
}

export function firstPresentation(tool: Tool): Mention {
  const [first, ...rest] = tool.mentions

  if (!first) {
    throw new Error(`Tool "${tool.slug}" has no mentions`)
  }

  return rest.reduce(
    (earliest, mention) =>
      mention.publishedAt < earliest.publishedAt ? mention : earliest,
    first
  )
}

export function distinctChannelCount(tool: Tool): number {
  return new Set(tool.mentions.map((mention) => mention.channelId)).size
}

export function newestMentionsFirst(
  mentions: readonly Mention[]
): readonly Mention[] {
  return [...mentions].sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt)
  )
}
