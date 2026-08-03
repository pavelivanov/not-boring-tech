import type { Mention, Tool } from "@techdex/contracts"
import { describe, expect, it } from "vitest"

import { channels } from "../data/channels"
import { categories, kinds, tags, tools } from "../data/tools"
import {
  normalizeSearchText,
  parseSearchParams,
  searchTools,
  serializeSearchParams,
} from "./search"

const emptyFilters = {
  query: "",
  tags: [],
} as const
const filterOptions = {
  kinds,
  categories,
  channelIds: channels.map((channel) => channel.id),
  tags,
} as const

describe("deterministic retrieval", () => {
  it("normalizes case, compatibility Unicode, and repeated whitespace", () => {
    expect(normalizeSearchText("  ＬＭ　ＳＴＵＤＩＯ \n Desktop ")).toBe(
      "lm studio desktop"
    )
    expect(
      searchTools(tools, { ...emptyFilters, query: "  ＣＵＲＳＯＲ " })[0]?.slug
    ).toBe("cursor")
  })

  it("orders exact names before weaker matches", () => {
    const results = searchTools(tools, { ...emptyFilters, query: "cursor" })

    expect(results[0]?.slug).toBe("cursor")
  })

  it("retrieves reviewed related subjects without replacing them with Claude Code", () => {
    const cases = [
      ["claude code cheat sheet", "claude-code-cheat-sheet"],
      ["claude code channels", "claude-code-channels"],
      ["karpathy learning project", "nanochat"],
      ["claude code skills setup", "gstack"],
      ["figma mcp integration", "cursor-talk-to-figma-mcp"],
      ["containerized mcp servers", "mcp-containers"],
      ["open source answer engine", "perplexica"],
      ["cursor visual editor", "cursor-visual-editor"],
      ["clickhouse podcast", "clickhouse-podcast"],
      ["personal digital security guide", "surveillance-self-defense"],
    ] as const

    for (const [query, expectedSlug] of cases) {
      expect(searchTools(tools, { ...emptyFilters, query })[0]?.slug).toBe(
        expectedSlug
      )
    }
  })

  it("matches name prefixes and complete name tokens", () => {
    const results = searchTools(tools, { ...emptyFilters, query: "post" })

    expect(results[0]?.slug).toBe("postgres-new")
  })

  it("matches tags, categories, and description tokens", () => {
    expect(
      searchTools(tools, { ...emptyFilters, query: "pair programming" })[0]
        ?.slug
    ).toBe("tuple")
    expect(
      searchTools(tools, { ...emptyFilters, query: "observability" })[0]?.slug
    ).toBe("datadog")
    expect(
      searchTools(tools, { ...emptyFilters, query: "technical audit" })[0]?.slug
    ).toBe("claude-code-technical-audit-guide")
  })

  it("combines query, category, and tag facets with AND", () => {
    const results = searchTools(tools, {
      query: "postgres",
      category: "Data systems",
      tags: ["WASM"],
    })

    expect(results.map((tool) => tool.slug)).toEqual(["pglite"])
  })

  it("uses OR within the selected tag facet", () => {
    const results = searchTools(tools, {
      ...emptyFilters,
      tags: ["database client", "coding agent"],
    })

    expect(results.map((tool) => tool.slug)).toEqual(
      expect.arrayContaining(["tableplus", "claude-code", "opencode"])
    )
  })

  it("returns all eligible tools for an empty query", () => {
    expect(searchTools(tools, emptyFilters)).toHaveLength(tools.length)
    expect(
      searchTools(tools, {
        ...emptyFilters,
        category: "Security",
      }).map((tool) => tool.slug)
    ).toEqual(["surveillance-self-defense"])
  })

  it("filters by source channel", () => {
    const results = searchTools(tools, {
      ...emptyFilters,
      channelId: "notboring-tech",
    })

    expect(results).toHaveLength(23)
    expect(
      results.every((tool) =>
        tool.mentions.some((mention) => mention.channelId === "notboring-tech")
      )
    ).toBe(true)
  })

  it("filters by technology type", () => {
    const results = searchTools(tools, {
      ...emptyFilters,
      kind: "GUIDE",
    })

    expect(results).toHaveLength(8)
    expect(results.every((tool) => tool.kind === "GUIDE")).toBe(true)
  })

  it("breaks equal scores by channel count and then name", () => {
    const firstMention: Mention = {
      channelId: "one",
      sourceUrl: "https://t.me/example/1",
      publishedAt: "2026-01-01T00:00:00.000Z",
      collectedAt: "2026-01-01T01:00:00.000Z",
    }
    const base = {
      kind: "TOOL",
      canonicalUrl: "https://example.com/tool",
      description: "terminal helper",
      category: "Developer tools",
      tags: ["terminal"],
      mentions: [firstMention],
    } satisfies Omit<Tool, "slug" | "name">
    const corpus: readonly Tool[] = [
      {
        ...base,
        slug: "beta",
        name: "Beta",
        canonicalUrl: "https://example.com/beta",
      },
      {
        ...base,
        slug: "alpha",
        name: "Alpha",
        canonicalUrl: "https://example.com/alpha",
      },
      {
        ...base,
        slug: "gamma",
        name: "Gamma",
        canonicalUrl: "https://example.com/gamma",
        mentions: [
          ...base.mentions,
          {
            ...firstMention,
            channelId: "two",
            sourceUrl: "https://t.me/example/2",
          },
        ],
      },
    ]

    expect(
      searchTools(corpus, { ...emptyFilters, query: "terminal" }).map(
        (tool) => tool.slug
      )
    ).toEqual(["gamma", "alpha", "beta"])
  })
})

describe("URL filter state", () => {
  it("parses valid values and ignores invalid or duplicate facets", () => {
    const params = new URLSearchParams(
      "q=%20local+++models%20&type=guide&category=AI+development&category=Security&channel=CTODAILY&tag=LLM&tag=LLM&tag=unknown"
    )

    expect(parseSearchParams(params, filterOptions)).toEqual({
      query: "local models",
      kind: "GUIDE",
      category: "AI development",
      channelId: "ctodaily",
      tags: ["LLM"],
    })
  })

  it("serializes stable facets and round-trips", () => {
    const state = {
      query: "  local   models ",
      kind: "TOOL",
      category: "AI development",
      channelId: "notboring-tech",
      tags: ["terminal", "LLM", "terminal"],
    } as const
    const params = serializeSearchParams(state)

    expect(params.toString()).toBe(
      "q=local+models&type=TOOL&category=AI+development&channel=notboring-tech&tag=LLM&tag=terminal"
    )
    expect(parseSearchParams(params, filterOptions)).toEqual({
      query: "local models",
      kind: "TOOL",
      category: "AI development",
      channelId: "notboring-tech",
      tags: ["LLM", "terminal"],
    })
  })
})
