import { describe, expect, it, vi } from "vitest"

import {
  CatalogApiError,
  loadCatalogDetail,
  loadHomeCatalog,
} from "./api-client"

const baseUrl = "https://api.example.test/root/"

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("catalog API client", () => {
  it("forwards only supported filters and validates parallel home responses", async () => {
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
          tags: [],
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
      facets: { categories: [], kinds: [], channels: [], tags: [] },
      channels: { channels: [] },
    })

    const requestedUrls = fetcher.mock.calls.map(([input]) => input.toString())
    expect(requestedUrls).toHaveLength(3)
    expect(requestedUrls.find((url) => url.includes("/v1/catalog?"))).toContain(
      "q=signal&kind=LIBRARY&tag=runtime&sort=name"
    )
    expect(requestedUrls.join("\n")).not.toContain("admin")
  })

  it("passes cancellation signals to fetch", async () => {
    const controller = new AbortController()
    let receivedSignal: AbortSignal | null | undefined
    const fetcher = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        receivedSignal = init?.signal
        return jsonResponse(
          {
            error: {
              code: "NOT_FOUND",
              message: "Catalog item not found",
              requestId: "request-404",
            },
          },
          404
        )
      }
    )

    await expect(
      loadCatalogDetail("runtime-item", controller.signal, {
        baseUrl,
        fetcher: fetcher as typeof fetch,
      })
    ).resolves.toBeNull()
    expect(receivedSignal).toBe(controller.signal)
  })

  it("rejects successful responses that do not satisfy the DTO contract", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ item: { slug: "broken" } })
    )

    await expect(
      loadCatalogDetail("broken", undefined, {
        baseUrl,
        fetcher: fetcher as typeof fetch,
      })
    ).rejects.toMatchObject({
      status: 200,
      code: "API_INVALID_RESPONSE",
    } satisfies Partial<CatalogApiError>)
  })
})
