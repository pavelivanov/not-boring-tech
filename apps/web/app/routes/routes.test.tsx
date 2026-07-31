import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
  type InitialEntry,
} from "react-router"
import { describe, expect, it, vi } from "vitest"

import { toolsBySlug } from "~/data/tools"
import { formatAbsoluteDate } from "~/domain/dates"
import { firstPresentation, newestMentionsFirst } from "~/domain/tools"

import Home from "./home"
import NotFound from "./not-found"
import ToolDetail from "./tool-detail"

const routes = [
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/tools/:slug",
    Component: ToolDetail,
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

describe("home route", () => {
  it("hydrates a shared filtered URL from the unfiltered prerender", async () => {
    const prerenderedMarkup = renderToString(
      <MemoryRouter initialEntries={["/"]}>
        <Home />
      </MemoryRouter>
    )
    const container = document.createElement("div")
    container.innerHTML = prerenderedMarkup
    document.body.append(container)
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined

    try {
      await act(async () => {
        root = hydrateRoot(
          container,
          <MemoryRouter initialEntries={["/?channel=notboring-tech"]}>
            <Home />
          </MemoryRouter>
        )
      })

      await waitFor(() => {
        expect(
          within(container).getByRole("heading", { name: "23 entries" })
        ).toBeInTheDocument()
      })
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      if (root) {
        await act(async () => root?.unmount())
      }

      consoleError.mockRestore()
      container.remove()
    }
  })

  it("renders the unfiltered corpus as a single result list", () => {
    renderAt()

    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1")
    expect(
      screen.getByRole("heading", { name: "58 entries" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("article")).toHaveLength(58)
    expect(
      screen.queryByRole("textbox", { name: "Search index" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Cursor" })).toHaveAttribute(
      "href",
      "/tools/cursor"
    )
  })

  it("updates results and URL for category and multiple tag filters", async () => {
    const user = userEvent.setup()
    const router = renderAt()

    await user.click(screen.getByRole("combobox", { name: "Category" }))
    await user.click(screen.getByRole("option", { name: "Data systems" }))

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "4 entries" })
      ).toBeInTheDocument()
      expect(router.state.location.search).toBe("?category=Data+systems")
    })

    await user.click(screen.getByRole("combobox", { name: "Tags" }))
    await user.click(screen.getByRole("option", { name: "browser" }))

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "2 entries" })
      ).toBeInTheDocument()
      expect(router.state.location.search).toBe(
        "?category=Data+systems&tag=browser"
      )
    })

    await user.click(screen.getByRole("option", { name: "serverless" }))

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "3 entries" })
      ).toBeInTheDocument()
      expect(router.state.location.search).toBe(
        "?category=Data+systems&tag=browser&tag=serverless"
      )
    })
  })

  it("filters by source channel from the selector", async () => {
    const user = userEvent.setup()
    const router = renderAt()

    await user.click(screen.getByRole("combobox", { name: "Source channel" }))
    expect(
      screen.queryByRole("option", { name: /@ai_newz/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: /@denissexy/ })
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole("option", {
        name: "@notboring_tech · Not Boring Tech",
      })
    )

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "23 entries" })
      ).toBeInTheDocument()
      expect(router.state.location.search).toBe("?channel=notboring-tech")
      expect(screen.getByText("Source · @notboring_tech")).toBeInTheDocument()
    })
  })

  it("makes each card's source chip a channel filter", async () => {
    const user = userEvent.setup()
    const router = renderAt()
    const cursorCard = screen
      .getByRole("link", { name: "Cursor" })
      .closest("article")

    expect(cursorCard).not.toBeNull()

    const sourceChip = within(cursorCard!).getByRole("link", {
      name: "Filter by source channel запуск завтра (@ctodaily)",
    })

    expect(sourceChip).toHaveAttribute("href", "/?channel=ctodaily")
    await user.click(sourceChip)

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "35 entries" })
      ).toBeInTheDocument()
      expect(router.state.location.search).toBe("?channel=ctodaily")
    })
  })

  it("clears an incompatible source and category combination", async () => {
    const user = userEvent.setup()
    const router = renderAt()

    await user.click(screen.getByRole("combobox", { name: "Category" }))
    await user.click(screen.getByRole("option", { name: "Security" }))
    await user.click(screen.getByRole("combobox", { name: "Source channel" }))
    await user.click(
      screen.getByRole("option", {
        name: "@notboring_tech · Not Boring Tech",
      })
    )

    expect(
      screen.getByRole("heading", { name: "0 entries" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("No entries match this combination")
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe(
      "?category=Security&channel=notboring-tech"
    )

    await user.click(screen.getByRole("button", { name: "Clear filters" }))

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "58 entries" })
      ).toBeInTheDocument()
      expect(router.state.location.search).toBe("")
    })
  })

  it("renders canonical external links with safe new-tab attributes", () => {
    renderAt()

    const canonicalLink = screen
      .getAllByRole("link", {
        name: "cursor.com (opens in a new tab)",
      })
      .find((link) => link.getAttribute("href") === "https://www.cursor.com/")

    expect(canonicalLink).toBeDefined()
    expect(canonicalLink).toHaveAttribute("href", "https://www.cursor.com/")
    expect(canonicalLink).toHaveAttribute("target", "_blank")
    expect(canonicalLink).toHaveAttribute("rel", "noreferrer")
  })
})

describe("tool detail route", () => {
  it("lists every source mention with dates and safe source links", () => {
    renderAt("/tools/cursor")

    const cursor = toolsBySlug.get("cursor")
    const sourceLinks = screen.getAllByRole("link", {
      name: /Open Telegram source/,
    })

    expect(cursor).toBeDefined()
    expect(
      screen.getByRole("heading", { level: 1, name: "Cursor" })
    ).toBeInTheDocument()
    expect(sourceLinks).toHaveLength(cursor!.mentions.length)
    expect(
      screen.getByText(
        new RegExp(
          `First presented ${formatAbsoluteDate(
            firstPresentation(cursor!).publishedAt
          )}`
        )
      )
    ).toBeInTheDocument()
    const expectedMentions = newestMentionsFirst(cursor!.mentions)

    for (const [index, link] of sourceLinks.entries()) {
      expect(link).toHaveAttribute("href", expectedMentions[index]?.sourceUrl)
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noreferrer")
    }

    const visitLink = screen.getByRole("link", { name: /Open tool/ })
    expect(visitLink).toHaveAttribute("href", cursor!.canonicalUrl)
    expect(visitLink).toHaveAttribute("target", "_blank")
    expect(visitLink).toHaveAttribute("rel", "noreferrer")
  })

  it("shows feature identity and links to its parent without merging provenance", () => {
    renderAt("/tools/claude-code-channels")

    const channels = toolsBySlug.get("claude-code-channels")

    expect(channels).toBeDefined()
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Claude Code Channels",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("Feature")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Claude Code" })).toHaveAttribute(
      "href",
      "/tools/claude-code"
    )
    expect(
      screen.getAllByRole("link", { name: /Open Telegram source/ })
    ).toHaveLength(1)
  })

  it("presents the reviewed reference as a cheat sheet, not its parent tool", () => {
    renderAt("/tools/claude-code-cheat-sheet")

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Claude Code Cheat Sheet",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("Cheat sheet")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Open cheat sheet/ })
    ).toHaveAttribute("href", "https://cc.storyfox.cz/")
  })

  it("renders a real not-found state for an unknown slug", () => {
    renderAt("/tools/not-in-the-corpus")

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "This subject is not in the index.",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Unknown subject / not-in-the-corpus")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Return to index" })
    ).toHaveAttribute("href", "/")
  })

  it("uses the catch-all route for an unknown page", () => {
    renderAt("/not-a-real-page")

    const main = screen.getByRole("main")
    expect(
      within(main).getByRole("heading", {
        level: 1,
        name: "That page never made it into the index.",
      })
    ).toBeInTheDocument()
  })
})
