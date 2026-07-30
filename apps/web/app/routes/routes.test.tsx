import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  createMemoryRouter,
  RouterProvider,
  type InitialEntry,
} from "react-router"
import { describe, expect, it } from "vitest"

import { toolsBySlug } from "~/data/tools"
import { newestMentionsFirst } from "~/domain/tools"

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
  it("renders the unfiltered corpus as a single result list", () => {
    renderAt()

    expect(
      screen.getByRole("heading", { name: "40 tools" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("article")).toHaveLength(40)
    expect(screen.getByRole("link", { name: "Cursor" })).toHaveAttribute(
      "href",
      "/tools/cursor"
    )
  })

  it("updates results and URL for category and multiple tag filters", async () => {
    const user = userEvent.setup()
    const router = renderAt()

    await user.click(screen.getByRole("combobox", { name: "Category" }))
    await user.click(screen.getByRole("option", { name: "Security" }))

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "2 tools" })
      ).toBeInTheDocument()
      expect(router.state.location.search).toBe("?category=Security")
    })

    await user.click(screen.getByRole("combobox", { name: "Tags" }))
    await user.click(screen.getByRole("option", { name: "terminal" }))

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "1 tool" })
      ).toBeInTheDocument()
      expect(router.state.location.search).toBe(
        "?category=Security&tag=terminal"
      )
    })

    await user.click(screen.getByRole("option", { name: "static analysis" }))

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "2 tools" })
      ).toBeInTheDocument()
      expect(router.state.location.search).toBe(
        "?category=Security&tag=static+analysis&tag=terminal"
      )
    })
  })

  it("retains an empty-result query and clears back to the corpus", async () => {
    const user = userEvent.setup()
    const router = renderAt("/?q=no-such-technology")
    const searchInput = screen.getByRole("textbox", {
      name: "Search tools",
    })

    expect(searchInput).toHaveValue("no-such-technology")
    expect(screen.getByRole("heading", { name: "0 tools" })).toBeInTheDocument()
    expect(
      screen.getByText("No tools match this combination")
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe("?q=no-such-technology")

    await user.click(screen.getByRole("button", { name: "Clear filters" }))

    await waitFor(() => {
      expect(searchInput).toHaveValue("")
      expect(
        screen.getByRole("heading", { name: "40 tools" })
      ).toBeInTheDocument()
      expect(router.state.location.search).toBe("")
    })
  })

  it("renders canonical external links with safe new-tab attributes", () => {
    renderAt()

    const canonicalLink = screen.getByRole("link", {
      name: /cursor\.com/,
    })

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
    expect(screen.getByText(/First presented Jan 14, 2026/)).toBeInTheDocument()
    const expectedMentions = newestMentionsFirst(cursor!.mentions)

    for (const [index, link] of sourceLinks.entries()) {
      expect(link).toHaveAttribute("href", expectedMentions[index]?.sourceUrl)
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noreferrer")
    }

    const visitLink = screen.getByRole("link", { name: /Visit tool/ })
    expect(visitLink).toHaveAttribute("href", cursor!.canonicalUrl)
    expect(visitLink).toHaveAttribute("target", "_blank")
    expect(visitLink).toHaveAttribute("rel", "noreferrer")
  })

  it("renders a real not-found state for an unknown slug", () => {
    renderAt("/tools/not-in-the-corpus")

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "This tool is not in the index.",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Unknown tool / not-in-the-corpus")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Return to search" })
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
