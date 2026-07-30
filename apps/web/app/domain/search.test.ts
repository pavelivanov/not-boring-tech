import type { Tool } from "@techdex/contracts"
import { describe, expect, it } from "vitest"

import { retrievalEvalCases } from "../data/retrieval-eval"
import { categories, tags, tools } from "../data/tools"
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

describe("deterministic retrieval", () => {
  it("normalizes case, compatibility Unicode, and repeated whitespace", () => {
    expect(normalizeSearchText("  ＶＬＬＭ \n Runtime ")).toBe("vllm runtime")
    expect(
      searchTools(tools, { ...emptyFilters, query: "  ＶＬＬＭ " })[0]?.slug
    ).toBe("vllm")
  })

  it("orders exact names before weaker matches", () => {
    const results = searchTools(tools, { ...emptyFilters, query: "cursor" })

    expect(results[0]?.slug).toBe("cursor")
  })

  it("matches name prefixes and complete name tokens", () => {
    const results = searchTools(tools, { ...emptyFilters, query: "post" })

    expect(results[0]?.slug).toBe("postgresql")
  })

  it("matches tags, categories, and description tokens", () => {
    expect(
      searchTools(tools, { ...emptyFilters, query: "wireguard" })[0]?.slug
    ).toBe("tailscale")
    expect(
      searchTools(tools, { ...emptyFilters, query: "observability" })[0]?.slug
    ).toBe("sentry")
    expect(
      searchTools(tools, { ...emptyFilters, query: "productivity" })[0]?.slug
    ).toBe("obsidian")
  })

  it("combines query, category, and tag facets with AND", () => {
    const results = searchTools(tools, {
      query: "postgres",
      category: "Data systems",
      tags: ["serverless"],
    })

    expect(results.map((tool) => tool.slug)).toEqual(["neon", "supabase"])
  })

  it("uses OR within the selected tag facet", () => {
    const results = searchTools(tools, {
      ...emptyFilters,
      tags: ["Rust", "Go"],
    })

    expect(results.map((tool) => tool.slug)).toEqual(
      expect.arrayContaining(["zed", "qdrant", "pocketbase"])
    )
  })

  it("returns all eligible tools for an empty query", () => {
    expect(searchTools(tools, emptyFilters)).toHaveLength(tools.length)
    expect(
      searchTools(tools, {
        ...emptyFilters,
        category: "Security",
      }).map((tool) => tool.slug)
    ).toEqual(["1password-cli", "semgrep"])
  })

  it("breaks equal scores by channel count and then name", () => {
    const base = {
      canonicalUrl: "https://example.com/tool",
      description: "terminal helper",
      category: "Developer tools",
      tags: ["terminal"],
      mentions: [
        {
          channelId: "one",
          sourceUrl: "https://t.me/example/1",
          publishedAt: "2026-01-01T00:00:00.000Z",
          collectedAt: "2026-01-01T01:00:00.000Z",
        },
      ],
    } satisfies Omit<Tool, "slug" | "name">
    const corpus = [
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
            ...base.mentions[0],
            channelId: "two",
            sourceUrl: "https://t.me/example/2",
          },
        ],
      },
    ] satisfies readonly Tool[]

    expect(
      searchTools(corpus, { ...emptyFilters, query: "terminal" }).map(
        (tool) => tool.slug
      )
    ).toEqual(["gamma", "alpha", "beta"])
  })

  it("meets the temporary top-five retrieval threshold", () => {
    const failures = retrievalEvalCases.flatMap((testCase) => {
      const results = searchTools(tools, {
        query: testCase.query,
        ...(testCase.category ? { category: testCase.category } : {}),
        tags: testCase.tags ?? [],
      })
      const topFive = results.slice(0, 5).map((tool) => tool.slug)
      const passed = testCase.expectedToolSlugs.some((slug) =>
        topFive.includes(slug)
      )

      return passed
        ? []
        : [
            `${testCase.query}: expected ${testCase.expectedToolSlugs.join(
              ", "
            )}; received ${topFive.join(", ") || "no results"}`,
          ]
    })
    const passCount = retrievalEvalCases.length - failures.length

    if (failures.length > 0) {
      console.warn(failures.join("\n"))
    }

    expect(failures.length, failures.join("\n")).toBeLessThanOrEqual(3)
    expect(passCount).toBeGreaterThanOrEqual(12)
  })
})

describe("URL search state", () => {
  it("parses valid values and ignores invalid or duplicate facets", () => {
    const params = new URLSearchParams(
      "q=%20local+++models%20&category=AI+development&category=Security&tag=LLM&tag=LLM&tag=unknown"
    )

    expect(parseSearchParams(params, { categories, tags })).toEqual({
      query: "local models",
      category: "AI development",
      tags: ["LLM"],
    })
  })

  it("serializes a stable query string and round-trips", () => {
    const state = {
      query: "  local   models ",
      category: "AI development",
      tags: ["terminal", "LLM", "terminal"],
    } as const
    const params = serializeSearchParams(state)

    expect(params.toString()).toBe(
      "q=local+models&category=AI+development&tag=LLM&tag=terminal"
    )
    expect(parseSearchParams(params, { categories, tags })).toEqual({
      query: "local models",
      category: "AI development",
      tags: ["LLM", "terminal"],
    })
  })
})
