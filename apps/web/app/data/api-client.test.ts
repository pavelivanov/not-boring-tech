import { describe, expect, it, vi } from "vitest"

import { loadHomeCatalog } from "./api-client"

const baseUrl = "https://api.example.test/root/"

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("catalog API client", () => {
  it("forwards supported filters and reuses validated home metadata", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString()
      )

      if (url.pathname === "/root/v1/catalog") {
        return jsonResponse({
          items: [],
          nextCursor: null,
          filters: {
            q: "signal",
            kind: ["LIBRARY"],
            category: [],
            channel: [],
            tag: ["runtime"],
            sort: "name",
            limit: 24,
          },
        })
      }
      if (url.pathname === "/root/v1/facets") {
        return jsonResponse({
          categories: [],
          kinds: [],
          channels: [],
        })
      }
      if (url.pathname === "/root/v1/channels") {
        return jsonResponse({ channels: [] })
      }
      throw new Error(`Unexpected URL: ${url.href}`)
    })

    await expect(
      loadHomeCatalog(
        "https://web.example.test/?q=signal&kind=LIBRARY&tag=runtime&sort=name&admin=true",
        undefined,
        { baseUrl, fetcher: fetcher as typeof fetch }
      )
    ).resolves.toEqual({
      catalog: {
        items: [],
        nextCursor: null,
        filters: {
          q: "signal",
          kind: ["LIBRARY"],
          category: [],
          channel: [],
          tag: ["runtime"],
          sort: "name",
          limit: 24,
        },
      },
      facets: { categories: [], kinds: [], channels: [] },
      channels: { channels: [] },
    })

    const requestedUrls = fetcher.mock.calls.map(([input]) => input.toString())
    expect(requestedUrls).toHaveLength(3)
    expect(requestedUrls.find((url) => url.includes("/v1/catalog?"))).toContain(
      "q=signal&kind=LIBRARY&tag=runtime&sort=name"
    )
    expect(requestedUrls.join("\n")).not.toContain("admin")

    await loadHomeCatalog("https://web.example.test/?kind=TOOL", undefined, {
      baseUrl,
      fetcher: fetcher as typeof fetch,
    })

    const repeatedUrls = fetcher.mock.calls.map(([input]) => input.toString())
    expect(repeatedUrls).toHaveLength(4)
    expect(
      repeatedUrls.filter((url) => url.includes("/v1/facets"))
    ).toHaveLength(1)
    expect(
      repeatedUrls.filter((url) => url.includes("/v1/channels"))
    ).toHaveLength(1)
    expect(repeatedUrls.at(-1)).toContain("/v1/catalog?kind=TOOL")
  })

  it("passes cancellation signals to fetch", async () => {
    const controller = new AbortController()
    const receivedSignals: Array<AbortSignal | null | undefined> = []
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        receivedSignals.push(init?.signal)
        const url = new URL(
          input instanceof Request ? input.url : input.toString()
        )
        if (url.pathname.endsWith("/v1/catalog")) {
          return jsonResponse({
            items: [],
            nextCursor: null,
            filters: {
              q: "",
              kind: [],
              category: [],
              channel: [],
              tag: [],
              sort: "latest",
              limit: 24,
            },
          })
        }
        if (url.pathname.endsWith("/v1/facets")) {
          return jsonResponse({ categories: [], kinds: [], channels: [] })
        }
        return jsonResponse({ channels: [] })
      }
    )

    await expect(
      loadHomeCatalog("https://web.example.test/", controller.signal, {
        baseUrl,
        fetcher: fetcher as typeof fetch,
      })
    ).resolves.toBeDefined()
    expect(receivedSignals).toEqual([
      controller.signal,
      controller.signal,
      controller.signal,
    ])
  })

  it("rejects successful responses that do not satisfy the DTO contract", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ item: { slug: "broken" } })
    )

    await expect(
      loadHomeCatalog("https://web.example.test/", undefined, {
        baseUrl,
        fetcher: fetcher as typeof fetch,
      })
    ).rejects.toMatchObject({
      status: 200,
      code: "API_INVALID_RESPONSE",
    })
  })
})
