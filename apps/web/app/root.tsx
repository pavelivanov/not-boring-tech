import {
  Links,
  Link,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router"

import type { Route } from "./+types/root"
import { cn } from "~/lib/utils"
import "./app.css"

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <a
          href="#main-content"
          className="fixed top-4 left-4 -translate-y-24 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <div className="min-h-svh">
          <header className="border-b">
            <div className="page-width flex h-16 items-center justify-between">
              <Link
                to="/"
                className="font-heading text-lg font-semibold tracking-[-0.04em]"
              >
                TechDex<span className="text-primary">/</span>
              </Link>
              <nav aria-label="Primary navigation" className="flex gap-5">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    cn(
                      "text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground",
                      isActive && "text-foreground underline"
                    )
                  }
                >
                  Index
                </NavLink>
                <NavLink
                  to="/about"
                  className={({ isActive }) =>
                    cn(
                      "text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground",
                      isActive && "text-foreground underline"
                    )
                  }
                >
                  About
                </NavLink>
              </nav>
            </div>
          </header>
          {children}
          <footer className="border-t">
            <div className="page-width flex flex-col gap-2 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>Public, read-only, and grounded in direct sources.</p>
              <p>No accounts · no analytics · direct sources</p>
            </div>
          </footer>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!"
  let details = "An unexpected error occurred."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error"
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="page-width flex min-h-[65svh] flex-col justify-center py-16"
    >
      <p className="font-mono text-sm text-muted-foreground">{message}</p>
      <h1 className="mt-4 max-w-3xl font-heading text-5xl font-semibold tracking-[-0.05em]">
        Something interrupted the index.
      </h1>
      <p className="mt-4 text-muted-foreground">{details}</p>
      <Link
        to="/"
        className="mt-8 w-fit font-medium underline decoration-primary decoration-2 underline-offset-4"
      >
        Return to index
      </Link>
      {stack && (
        <pre className="mt-8 w-full overflow-x-auto rounded-lg bg-muted p-4 text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
