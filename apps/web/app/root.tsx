import {
  Links,
  Link,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router"

import type { Route } from "./+types/root"
import "./app.css"
import { LocaleProvider, useLocale } from "~/lib/locale"

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <Document>{children}</Document>
    </LocaleProvider>
  )
}

function Document({ children }: { children: React.ReactNode }) {
  const { locale, copy } = useLocale()

  return (
    <html lang={locale}>
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
          {copy.common.skipToContent}
        </a>
        <div className="min-h-svh">{children}</div>
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
  const { copy } = useLocale()
  let message = "Oops!"
  let details = copy.rootError.unexpected
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error"
    details =
      error.status === 404
        ? copy.rootError.notFound
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
        {copy.rootError.interrupted}
      </h1>
      <p className="mt-4 text-muted-foreground">{details}</p>
      <Link
        to="/"
        className="mt-8 w-fit font-medium underline decoration-primary decoration-2 underline-offset-4"
      >
        {copy.common.returnToIndex}
      </Link>
      {stack && (
        <pre className="mt-8 w-full overflow-x-auto rounded-lg bg-muted p-4 text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
