import type {
  CatalogActiveFilters,
  CatalogCategory,
  CatalogListItem,
  TechnologyKind,
} from "@findthatproject/contracts"
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
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
  meta as homeMeta,
} from "./home"
import Index, {
  clientLoader as indexClientLoader,
  HydrateFallback as IndexHydrateFallback,
} from "./index"
import NotFound from "./not-found"
import { LocaleProvider, localeStorageKey } from "~/lib/locale"

const apiOrigin = "https://catalog-api.example.test"
const now = "2026-08-03T10:00:00.000Z"

const item = {
  slug: "dynamic-signal",
  name: "Dynamic Signal",
  nameRu: "Динамический сигнал",
  kind: "LIBRARY",
  category: "Developer tools",
  parentName: "Runtime Parent",
  parentNameRu: "Родитель среды выполнения",
  canonicalUrl: "https://dynamic.example.test/",
  githubStars: 12_438,
  githubStarsUpdatedAt: "2026-08-03T08:00:00.000Z",
  descriptionEn: "A synthetic subject returned only by the test API.",
  descriptionRu: "Синтетическая запись, возвращаемая только тестовым API.",
  tags: ["runtime", "signal"],
  firstMentionedAt: "2026-08-01T10:00:00.000Z",
  lastMentionedAt: now,
  sourceUrl: "https://t.me/signal_lab/42",
  mentionCount: 2,
  channelCount: 1,
} satisfies CatalogListItem

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

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

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

async function runIndexLoader({ request }: LoaderFunctionArgs) {
  return indexClientLoader({
    request,
  } as Parameters<typeof indexClientLoader>[0])
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

function IndexTestRoute() {
  const props = {
    loaderData: useLoaderData<Awaited<ReturnType<typeof indexClientLoader>>>(),
    params: useParams(),
    matches: [],
  } as unknown as Parameters<typeof Index>[0]

  return <Index {...props} />
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
    path: "/index",
    loader: runIndexLoader,
    Component: IndexTestRoute,
    ErrorBoundary: HomeTestErrorBoundary,
    HydrateFallback: IndexHydrateFallback,
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

  render(
    <LocaleProvider>
      <RouterProvider router={router} />
    </LocaleProvider>
  )
  return router
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
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
  it("publishes the branded large-preview image metadata", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_ORIGIN", "https://findthatproject.test")

    expect(homeMeta()).toEqual(
      expect.arrayContaining([
        {
          property: "og:image",
          content: "https://findthatproject.test/weekly-digest-cover.png",
        },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
      ])
    )
  })

  it("links to both weekly digest channels", async () => {
    renderAt()

    expect(
      await screen.findByRole("link", {
        name: "RU weekly digest on Telegram (opens in a new tab)",
      })
    ).toHaveAttribute("href", "https://t.me/findthatproject_weekly_digest_ru")
    expect(
      screen.getByRole("link", {
        name: "EN weekly digest on Telegram (opens in a new tab)",
      })
    ).toHaveAttribute("href", "https://t.me/findthatproject_weekly_digest_en")
  })

  it("restores, switches, and persists the selected locale", async () => {
    window.localStorage.setItem(localeStorageKey, "ru")
    const user = userEvent.setup()
    renderAt()

    expect(await screen.findByRole("button", { name: "Поиск" })).toBeVisible()
    expect(
      screen.getByRole("link", {
        name: /Динамический сигнал — сайт проекта/,
      })
    ).toBeVisible()
    expect(
      screen.getByText(
        "Синтетическая запись, возвращаемая только тестовым API."
      )
    ).toBeVisible()
    expect(document.documentElement).toHaveAttribute("lang", "ru")
    expect(screen.getByRole("radio", { name: "Русский" })).toHaveAttribute(
      "data-state",
      "on"
    )

    await user.click(screen.getByRole("radio", { name: "English" }))

    expect(screen.getByRole("button", { name: "Search" })).toBeVisible()
    expect(
      screen.getByRole("link", { name: /Dynamic Signal project/ })
    ).toBeVisible()
    expect(
      screen.getByText("A synthetic subject returned only by the test API.")
    ).toBeVisible()
    expect(document.documentElement).toHaveAttribute("lang", "en")
    await waitFor(() =>
      expect(window.localStorage.getItem(localeStorageKey)).toBe("en")
    )
  })

  it("renders the traction-led full index from the live API", async () => {
    renderAt("/index")

    const projectLink = await screen.findByRole("link", {
      name: /Dynamic Signal project/,
    })
    expect(projectLink).toHaveAttribute("href", "https://dynamic.example.test/")
    expect(projectLink).toHaveAttribute("target", "_blank")
    expect(projectLink).toHaveAttribute("rel", "noreferrer")
    expect(screen.getByLabelText("12,438 GitHub stars")).toBeVisible()
    const sourceLink = screen.getByRole("link", {
      name: "Open Dynamic Signal source (opens in a new tab)",
    })
    expect(sourceLink).toHaveTextContent(/^source$/i)
    expect(sourceLink).toHaveAttribute("href", "https://t.me/signal_lab/42")
    expect(sourceLink).toHaveAttribute("target", "_blank")
    expect(sourceLink).toHaveAttribute("rel", "noreferrer")
    expect(screen.getByText("1 AUG 2026")).toBeVisible()
    expect(screen.getByRole("button", { name: /^Library 1$/ })).toBeVisible()
    expect(screen.getByText(/All · Showing 1 of 1/)).toBeVisible()
    expect(screen.getByText("Sorted by traction")).toBeVisible()
    expect(
      fetchSpy.mock.calls
        .map(([input]) => new URL(input.toString()))
        .find((url) => url.pathname === "/v1/catalog")
        ?.searchParams.get("sort")
    ).toBe("stars")
    expect(screen.getByRole("link", { name: "Full index" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("renders new entries as a dedicated catch-up page", async () => {
    renderAt()

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "1 entry you have not seen",
      })
    ).toBeVisible()
    expect(screen.getByText("Earlier this week")).toBeVisible()
    expect(screen.getByText("1 entry")).toBeVisible()
    expect(screen.getByRole("button", { name: /^All 1$/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("link", { name: /^New 1$/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("switches the ledger between traction and newest order", async () => {
    const user = userEvent.setup()
    const router = renderAt("/index")

    await user.click(await screen.findByRole("button", { name: "Newest" }))
    await waitFor(() =>
      expect(router.state.location.search).toBe("?sort=latest")
    )
    expect(screen.getByRole("button", { name: "Newest" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByText("Newest first")).toBeVisible()
    expect(
      fetchSpy.mock.calls
        .map(([input]) => new URL(input.toString()))
        .filter((url) => url.pathname === "/v1/catalog")
        .at(-1)
        ?.searchParams.get("sort")
    ).toBe("latest")
  })

  it("keeps an opened entry visible as read until the page reloads", async () => {
    const user = userEvent.setup()
    renderAt()

    const projectLink = await screen.findByRole("link", {
      name: /Dynamic Signal project/,
    })
    const row = projectLink.closest("article")
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByRole("img", {
        name: "New since your last visit",
      })
    ).toBeVisible()

    await user.click(projectLink)
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "0 entries you have not seen",
      })
    ).toBeVisible()
    expect(
      screen.getByRole("link", { name: /Dynamic Signal project/ })
    ).toBeVisible()
    expect(
      within(row as HTMLElement).queryByRole("img", {
        name: "New since your last visit",
      })
    ).toBeNull()

    await waitFor(() =>
      expect(
        JSON.parse(
          window.localStorage.getItem("findthatproject:read-state:v1") ?? "{}"
        ).seen
      ).toContain("dynamic-signal")
    )

    cleanup()
    renderAt()
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "You are caught up",
      })
    ).toBeVisible()
    expect(
      screen.queryByRole("link", { name: /Dynamic Signal project/ })
    ).toBeNull()
  })

  it("suggests unseen entries in the search dialog before a query", async () => {
    const user = userEvent.setup()
    renderAt()

    await user.click(await screen.findByRole("button", { name: "Search" }))
    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByRole("link", { name: /Dynamic Signal project/ })
    ).toBeVisible()

    await user.type(
      within(dialog).getByRole("searchbox", { name: "Search index" }),
      "nothing-here"
    )
    expect(
      within(dialog).getByText("No loaded entry matches that.")
    ).toBeVisible()
  })

  it("navigates between the separate New and Full Index pages", async () => {
    const user = userEvent.setup()
    renderAt()

    const indexLink = await screen.findByRole("link", { name: "Full index" })
    expect(screen.getByRole("link", { name: /^New 1$/ })).toHaveAttribute(
      "aria-current",
      "page"
    )

    await user.click(indexLink)
    expect(await screen.findByText("Sorted by traction")).toBeVisible()
    expect(screen.getByRole("link", { name: "Full index" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("keeps type and search filters in URL state", async () => {
    const user = userEvent.setup()
    const router = renderAt("/index")

    await screen.findByRole("link", { name: /Dynamic Signal project/ })
    await user.click(screen.getByRole("button", { name: /^Library 1$/ }))
    await waitFor(() =>
      expect(
        router.state.location.pathname + router.state.location.search
      ).toBe("/index?kind=LIBRARY")
    )
    await user.click(screen.getByRole("button", { name: "Search" }))
    await user.type(
      await screen.findByRole("searchbox", { name: "Search index" }),
      "runtime{Enter}"
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
    const catalogUrls = requestedUrls.filter(
      (url) => url.pathname === "/v1/catalog"
    )
    expect(catalogUrls).toHaveLength(3)
    expect(
      catalogUrls.every((url) => url.searchParams.get("sort") === "stars")
    ).toBe(true)
    expect(screen.getByRole("button", { name: /^Library 1$/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("mark all seen drains the counter and reset restores it", async () => {
    window.localStorage.setItem(
      "findthatproject:read-state:v1",
      JSON.stringify({
        seen: [],
        seenThrough: null,
        lastVisit: "2026-08-02T10:00:00.000Z",
      })
    )
    const user = userEvent.setup()
    renderAt()

    await user.click(
      await screen.findByRole("button", { name: "Mark all seen" })
    )
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "You are caught up",
      })
    ).toBeVisible()
    expect(
      screen.getByText(
        "Everything indexed since 2 August is marked as seen. New entries land here as they are added."
      )
    ).toBeVisible()
    expect(
      screen.getByRole("link", { name: "Browse full index" })
    ).toHaveAttribute("href", "/index")
    expect(
      screen.queryByRole("navigation", {
        name: "Filter new entries by type",
      })
    ).toBeNull()

    await user.click(screen.getByRole("button", { name: "Show them again" }))
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "1 entry you have not seen",
      })
    ).toBeVisible()
  })

  it("read-state actions do not erase active index filters", async () => {
    const user = userEvent.setup()
    const router = renderAt("/?q=runtime&kind=LIBRARY")

    await screen.findByRole("link", { name: /Dynamic Signal project/ })
    await user.click(screen.getByRole("button", { name: "Mark all seen" }))
    await user.click(
      await screen.findByRole("button", { name: "Show them again" })
    )

    expect(router.state.location.search).toBe("?q=runtime&kind=LIBRARY")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(
      await screen.findByRole("searchbox", { name: "Search index" })
    ).toHaveValue("runtime")
  })

  it("distinguishes an empty database from filtered zero results", async () => {
    databaseEmpty = true
    const { unmount } = render(
      <LocaleProvider>
        <RouterProvider router={createMemoryRouter(routes)} />
      </LocaleProvider>
    )

    expect(await screen.findByText("No parsed entries yet")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull()
    unmount()

    databaseEmpty = false
    installApiFake()
    renderAt("/?q=missing")
    expect(await screen.findByText("No entry matches “missing”")).toBeVisible()
    expect(screen.getByRole("button", { name: "Clear search" })).toBeVisible()
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
    const { container } = render(
      <LocaleProvider>
        <HomeHydrateFallback />
      </LocaleProvider>
    )

    expect(screen.getByLabelText("Loading catalog")).toBeVisible()
    expect(
      container.querySelectorAll('[data-slot="skeleton"]')
    ).not.toHaveLength(0)
  })
})

describe("catch-all route", () => {
  it("does not expose the removed item detail page", async () => {
    renderAt("/tools/dynamic-signal")

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "That page never made it into the index.",
      })
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
