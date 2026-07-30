import type { Mention, Tool } from "@techdex/contracts"

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
