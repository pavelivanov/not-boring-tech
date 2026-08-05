import type {
  CatalogActiveFilters,
  CatalogCategory,
  CatalogDetailItem,
  CatalogListItem,
  TechnologyKind,
} from "@findthatproject/contracts"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  createMemoryRouter,
  RouterProvider,
  type InitialEntry,
  type LoaderFunctionArgs,
  type RouteObject,
  useLoaderData,
  useParams,
  useRouteError,
} from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import Home, {
  clientLoader as homeClientLoader,
  ErrorBoundary as HomeErrorBoundary,
  HydrateFallback as HomeHydrateFallback,
} from "./home"
import NotFound from "./not-found"
import ToolDetail, {
  clientLoader as detailClientLoader,
  ErrorBoundary as DetailErrorBoundary,
} from "./tool-detail"

const apiOrigin = "https://catalog-api.example.test"
const now = "2026-08-03T10:00:00.000Z"

const item = {
  slug: "dynamic-signal",
  name: "Dynamic Signal",
  kind: "LIBRARY",
  category: "Developer tools",
  parentName: "Runtime Parent",
  canonicalUrl: "https://dynamic.example.test/",
  githubStars: 12_438,
  githubStarsUpdatedAt: "2026-08-03T08:00:00.000Z",
  descriptionEn: "A synthetic subject returned only by the test API.",
  tags: ["runtime", "signal"],
  firstMentionedAt: "2026-08-01T10:00:00.000Z",
  lastMentionedAt: now,
  mentionCount: 2,
  channelCount: 1,
} satisfies CatalogListItem

const detailItem = {
  ...item,
  mentions: [
    {
      channelHandle: "@signal_lab",
      channelTitle: "Signal Lab",
      channelPublicUrl: "https://t.me/signal_lab",
      sourceUrl: "https://t.me/signal_lab/42",
      publishedAt: now,
      confidence: 0.94,
    },
  ],
} satisfies CatalogDetailItem

const baseFilters = {
  q: "",
  kind: [],
  category: [],
  channel: [],
  tag: [],
  sort: "latest",
  limit: 24,
} satisfies CatalogActiveFilters

let catalogUnavailable = false
let databaseEmpty = false
let fetchSpy: ReturnType<typeof vi.fn>

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function filtersFromUrl(url: URL): CatalogActiveFilters {
  const sortValue = url.searchParams.get("sort")
  const sort =
    sortValue === "name" || sortValue === "stars" ? sortValue : "latest"

  return {
    q: url.searchParams.get("q") ?? "",
    kind: url.searchParams.getAll("kind") as TechnologyKind[],
    category: url.searchParams.getAll("category") as CatalogCategory[],
    channel: url.searchParams.getAll("channel"),
    tag: url.searchParams.getAll("tag"),
    sort,
    limit: 24,
  }
}

function installApiFake() {
  fetchSpy = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())

    if (url.pathname === "/v1/facets") {
      return jsonResponse({
        categories: databaseEmpty
          ? []
          : [{ value: "Developer tools", count: 1 }],
        kinds: databaseEmpty ? [] : [{ value: "LIBRARY", count: 1 }],
        channels: databaseEmpty
          ? []
          : [{ value: "@signal_lab", label: "Signal Lab", count: 1 }],
      })
    }

    if (url.pathname === "/v1/channels") {
      return jsonResponse({
        channels: databaseEmpty
          ? []
          : [
              {
                handle: "@signal_lab",
                title: "Signal Lab",
                publicUrl: "https://t.me/signal_lab",
                itemCount: 1,
                mentionCount: 2,
                latestMentionedAt: now,
              },
            ],
      })
    }

    if (url.pathname === "/v1/catalog/dynamic-signal") {
      return jsonResponse({ item: detailItem })
    }

    if (url.pathname.startsWith("/v1/catalog/")) {
      return jsonResponse(
        {
          error: {
            code: "NOT_FOUND",
            message: "Catalog item not found",
            requestId: "request-not-found",
          },
        },
        404
      )
    }

    if (url.pathname === "/v1/catalog") {
      if (catalogUnavailable) {
        return jsonResponse(
          {
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "Catalog temporarily unavailable",
              requestId: "request-retry-7",
            },
          },
          503
        )
      }

      const filters = filtersFromUrl(url)
      const filteredOut = filters.q === "missing"
      return jsonResponse({
        items: databaseEmpty || filteredOut ? [] : [item],
        nextCursor: null,
        filters,
      })
    }

    throw new Error(`Unexpected API request: ${url.href}`)
  })

  vi.stubGlobal("fetch", fetchSpy)
}

async function runHomeLoader({ request }: LoaderFunctionArgs) {
  return homeClientLoader({ request } as Parameters<typeof homeClientLoader>[0])
}

async function runDetailLoader(args: LoaderFunctionArgs) {
  return detailClientLoader(args as Parameters<typeof detailClientLoader>[0])
}

function HomeTestRoute() {
  const props = {
    loaderData: useLoaderData<Awaited<ReturnType<typeof homeClientLoader>>>(),
    params: useParams(),
    matches: [],
  } as unknown as Parameters<typeof Home>[0]

  return <Home {...props} />
}

function HomeTestErrorBoundary() {
  const props = {
    error: useRouteError(),
    params: useParams(),
    matches: [],
  } as unknown as Parameters<typeof HomeErrorBoundary>[0]

  return <HomeErrorBoundary {...props} />
}

function DetailTestRoute() {
  const props = {
    loaderData: useLoaderData<Awaited<ReturnType<typeof detailClientLoader>>>(),
    params: useParams(),
    matches: [],
  } as unknown as Parameters<typeof ToolDetail>[0]

  return <ToolDetail {...props} />
}

function DetailTestErrorBoundary() {
  const props = {
    error: useRouteError(),
    params: useParams(),
    matches: [],
  } as unknown as Parameters<typeof DetailErrorBoundary>[0]

  return <DetailErrorBoundary {...props} />
}

const routes: RouteObject[] = [
  {
    path: "/",
    loader: runHomeLoader,
    Component: HomeTestRoute,
    ErrorBoundary: HomeTestErrorBoundary,
    HydrateFallback: HomeHydrateFallback,
  },
  {
    path: "/tools/:slug",
    loader: runDetailLoader,
    Component: DetailTestRoute,
    ErrorBoundary: DetailTestErrorBoundary,
  },
  {
    path: "*",
    Component: NotFound,
  },
]

function renderAt(initialEntry: InitialEntry = "/") {
  const router = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  })

  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(now))
  vi.stubEnv("VITE_API_BASE_URL", apiOrigin)
  catalogUnavailable = false
  databaseEmpty = false
  installApiFake()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("home route", () => {
  it("renders the traction-led ledger from the live API", async () => {
    renderAt()

    const projectLink = await screen.findByRole("link", {
      name: /Dynamic Signal project/,
    })
    expect(projectLink).toHaveAttribute("href", "https://dynamic.example.test/")
    expect(projectLink).toHaveAttribute("target", "_blank")
    expect(projectLink).toHaveAttribute("rel", "noreferrer")
    expect(screen.getByLabelText("12,438 GitHub stars")).toBeVisible()
    expect(
      screen.getByRole("link", { name: "View Dynamic Signal provenance" })
    ).toHaveAttribute("href", "/tools/dynamic-signal")
    expect(screen.getByText("highest traction in this view")).toBeVisible()
    expect(screen.getByRole("radio", { name: "Unseen" })).toBeChecked()
    expect(screen.getByRole("button", { name: /^Library 1$/ })).toBeVisible()
    expect(screen.getByText("Showing 1 of 1")).toBeVisible()
  })

  it("marks opened rows seen and lets Index reveal them again", async () => {
    const user = userEvent.setup()
    renderAt()

    await user.click(
      await screen.findByRole("link", { name: /Dynamic Signal project/ })
    )
    expect(await screen.findByText("You are caught up.")).toBeVisible()

    await user.click(screen.getByRole("radio", { name: "Index" }))
    expect(
      await screen.findByRole("link", { name: /Dynamic Signal project/ })
    ).toBeVisible()
  })

  it("keeps type and search filters in URL state", async () => {
    const user = userEvent.setup()
    const router = renderAt()

    await screen.findByRole("link", { name: /Dynamic Signal project/ })
    await user.click(screen.getByRole("button", { name: /^Library 1$/ }))
    await waitFor(() =>
      expect(router.state.location.search).toBe("?kind=LIBRARY")
    )
    await user.type(
      screen.getByRole("searchbox", { name: "Search index" }),
      "runtime"
    )
    await waitFor(() =>
      expect(router.state.location.search).toContain("q=runtime")
    )

    const requestedUrls = fetchSpy.mock.calls.map(
      ([input]) => new URL(input.toString())
    )
    expect(
      requestedUrls.filter((url) => url.pathname === "/v1/facets")
    ).toHaveLength(1)
    expect(
      requestedUrls.filter((url) => url.pathname === "/v1/channels")
    ).toHaveLength(1)
    expect(
      requestedUrls.filter((url) => url.pathname === "/v1/catalog")
    ).toHaveLength(3)
    expect(screen.getByRole("button", { name: /^Library 1$/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("mark all seen drains the queue and Reset restores it", async () => {
    const user = userEvent.setup()
    renderAt()

    await screen.findByRole("link", { name: /Dynamic Signal project/ })
    await user.click(screen.getByRole("button", { name: "Mark all seen" }))
    expect(await screen.findByText("You are caught up.")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Reset" }))
    expect(
      await screen.findByRole("link", { name: /Dynamic Signal project/ })
    ).toBeVisible()
  })

  it("read-state actions do not erase active index filters", async () => {
    const user = userEvent.setup()
    const router = renderAt("/?q=runtime&kind=LIBRARY")

    await screen.findByRole("link", { name: /Dynamic Signal project/ })
    await user.click(screen.getByRole("button", { name: "Mark all seen" }))
    await user.click(screen.getByRole("button", { name: "Reset" }))

    expect(router.state.location.search).toBe("?q=runtime&kind=LIBRARY")
    expect(screen.getByRole("searchbox", { name: "Search index" })).toHaveValue(
      "runtime"
    )
  })

  it("distinguishes an empty database from filtered zero results", async () => {
    databaseEmpty = true
    const { unmount } = render(
      <RouterProvider router={createMemoryRouter(routes)} />
    )

    expect(await screen.findByText("No parsed entries yet")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull()
    unmount()

    databaseEmpty = false
    installApiFake()
    renderAt("/?q=missing")
    expect(
      await screen.findByText("No entries match this combination")
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeVisible()
  })

  it("shows a retryable API failure without a fixture fallback", async () => {
    catalogUnavailable = true
    const user = userEvent.setup()
    renderAt()

    expect(
      await screen.findByText("The catalog API is unavailable")
    ).toBeVisible()
    expect(screen.getByText(/request-retry-7/)).toBeVisible()
    expect(screen.queryByText("Dynamic Signal")).toBeNull()

    catalogUnavailable = false
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(
      await screen.findByRole("link", { name: /Dynamic Signal project/ })
    ).toBeVisible()
  })

  it("renders an accessible loading skeleton", () => {
    const { container } = render(<HomeHydrateFallback />)

    expect(screen.getByLabelText("Loading catalog")).toBeVisible()
    expect(
      container.querySelectorAll('[data-slot="skeleton"]')
    ).not.toHaveLength(0)
  })
})

describe("tool detail route", () => {
  it("resolves an arbitrary runtime slug with full source provenance", async () => {
    renderAt("/tools/dynamic-signal")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Dynamic Signal" })
    ).toBeVisible()
    expect(screen.getByText("Feature of")).toHaveTextContent(
      "Feature of Runtime Parent"
    )
    const sourceLink = screen.getByRole("link", {
      name: /Open Telegram source/,
    })
    expect(sourceLink).toHaveAttribute("href", "https://t.me/signal_lab/42")
    expect(sourceLink).toHaveAttribute("target", "_blank")
    expect(sourceLink).toHaveAttribute("rel", "noreferrer")
  })

  it("renders a real not-found state for an unknown API slug", async () => {
    renderAt("/tools/not-created-at-build-time")

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "This subject is not in the index.",
      })
    ).toBeVisible()
    expect(
      screen.getByText("Unknown subject / not-created-at-build-time")
    ).toBeVisible()
  })

  it("uses the catch-all route for an unknown page", async () => {
    renderAt("/not-a-real-page")

    const main = await screen.findByRole("main")
    expect(
      within(main).getByRole("heading", {
        level: 1,
        name: "That page never made it into the index.",
      })
    ).toBeVisible()
  })
})
