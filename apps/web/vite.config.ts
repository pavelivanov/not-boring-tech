import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type Plugin } from "vite"

import { tools } from "./app/data/tools"

const prerenderedPaths = new Set([
  "/about",
  ...tools.map((tool) => `/tools/${tool.slug}`),
])

function previewPrerenderedRoutes(): Plugin {
  return {
    name: "preview-prerendered-routes",
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (
          process.env.IS_RR_BUILD_REQUEST === "yes" ||
          !request.url ||
          (request.method !== "GET" && request.method !== "HEAD")
        ) {
          next()
          return
        }

        const url = new URL(request.url, "http://preview.local")
        const pathname = url.pathname.replace(/\/+$/u, "") || "/"
        const lastSegment = pathname.split("/").at(-1) ?? ""

        if (prerenderedPaths.has(pathname)) {
          request.url = `${pathname}/index.html${url.search}`
        } else if (pathname !== "/" && !lastSegment.includes(".")) {
          request.url = `/__spa-fallback.html${url.search}`
        }

        next()
      })
    },
  }
}

export default defineConfig({
  preview: {
    allowedHosts: [".railway.internal", ".railway.app"],
  },
  resolve: { tsconfigPaths: true },
  plugins: [previewPrerenderedRoutes(), tailwindcss(), reactRouter()],
})
