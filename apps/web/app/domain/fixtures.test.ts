import { describe, expect, it } from "vitest"

import { channels, isTemporaryCorpus } from "../data/channels"
import { retrievalEvalCases } from "../data/retrieval-eval"
import { categories, tags, tools } from "../data/tools"
import { distinctChannelCount, firstPresentation } from "./tools"

function expectUnique(values: readonly string[]): void {
  expect(new Set(values).size).toBe(values.length)
}

describe("temporary fixture invariants", () => {
  it("is visibly marked as temporary until the owner approves a corpus", () => {
    expect(isTemporaryCorpus).toBe(true)
  })

  it("provides enough records to exercise the planned interface", () => {
    expect(tools.length).toBeGreaterThanOrEqual(40)
    expect(categories.length).toBeGreaterThanOrEqual(5)
    expect(tags.length).toBeGreaterThanOrEqual(20)
    expect(
      tools.filter((tool) => distinctChannelCount(tool) >= 2).length
    ).toBeGreaterThanOrEqual(5)
    expect(retrievalEvalCases.length).toBeGreaterThanOrEqual(15)
  })

  it("keeps identifiers and URLs unique where required", () => {
    expectUnique(channels.map((channel) => channel.id))
    expectUnique(channels.map((channel) => channel.publicUrl))
    expectUnique(tools.map((tool) => tool.slug))
    expectUnique(tools.map((tool) => tool.canonicalUrl))
    expectUnique(
      tools.flatMap((tool) => tool.mentions.map((mention) => mention.sourceUrl))
    )
  })

  it("uses known channels, parseable UTC dates, and at least one mention", () => {
    const channelIds = new Set(channels.map((channel) => channel.id))

    for (const tool of tools) {
      expect(tool.mentions.length, tool.slug).toBeGreaterThan(0)
      expect(() => new URL(tool.canonicalUrl), tool.slug).not.toThrow()

      for (const mention of tool.mentions) {
        expect(channelIds.has(mention.channelId), tool.slug).toBe(true)
        expect(() => new URL(mention.sourceUrl), tool.slug).not.toThrow()
        expect(mention.publishedAt.endsWith("Z"), tool.slug).toBe(true)
        expect(mention.collectedAt.endsWith("Z"), tool.slug).toBe(true)
        expect(Number.isNaN(Date.parse(mention.publishedAt)), tool.slug).toBe(
          false
        )
        expect(Number.isNaN(Date.parse(mention.collectedAt)), tool.slug).toBe(
          false
        )
        expect(
          Date.parse(mention.collectedAt),
          `${tool.slug} collection date`
        ).toBeGreaterThanOrEqual(Date.parse(mention.publishedAt))
      }
    }
  })

  it("derives presentation dates and channel counts instead of storing them", () => {
    const cursor = tools.find((tool) => tool.slug === "cursor")

    expect(cursor).toBeDefined()
    expect(firstPresentation(cursor!).publishedAt).toBe(
      "2026-01-14T09:00:00.000Z"
    )
    expect(distinctChannelCount(cursor!)).toBe(2)
    expect("firstPresentedAt" in cursor!).toBe(false)
    expect("channelCount" in cursor!).toBe(false)
  })
})
