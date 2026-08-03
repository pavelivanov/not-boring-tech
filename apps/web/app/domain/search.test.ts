import type { CatalogActiveFilters } from "@techdex/contracts"
import { describe, expect, it } from "vitest"

import {
  filtersFromActive,
  normalizeSearchText,
  serializeSearchParams,
} from "./search"

describe("search URL state", () => {
  it("normalizes Unicode, case, and repeated whitespace", () => {
    expect(normalizeSearchText("  ＬＭ　ＳＴＵＤＩＯ \n Desktop ")).toBe(
      "lm studio desktop"
    )
  })

  it("maps validated API filters into the single-select controls", () => {
    const active = {
      q: "local models",
      kind: ["TOOL", "GUIDE"],
      category: ["AI development", "Security"],
      channel: ["@channel_one", "@channel_two"],
      tag: ["LLM", "terminal"],
      sort: "name",
      limit: 24,
    } satisfies CatalogActiveFilters

    expect(filtersFromActive(active)).toEqual({
      query: "local models",
      kind: "TOOL",
      category: "AI development",
      channel: "@channel_one",
      tags: ["LLM", "terminal"],
      sort: "name",
    })
  })

  it("serializes stable API query keys and removes duplicate tags", () => {
    const params = serializeSearchParams({
      query: "  local   models ",
      kind: "TOOL",
      category: "AI development",
      channel: "@channel_one",
      tags: ["terminal", "LLM", "terminal"],
      sort: "name",
    })

    expect(params.toString()).toBe(
      "q=local+models&kind=TOOL&category=AI+development&channel=%40channel_one&tag=LLM&tag=terminal&sort=name"
    )
  })

  it("omits empty and default values", () => {
    expect(
      serializeSearchParams({
        query: "  ",
        tags: [],
        sort: "latest",
      }).toString()
    ).toBe("")
  })
})
