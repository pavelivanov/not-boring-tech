import type { Config } from "@react-router/dev/config"

import { tools } from "./app/data/tools"

const toolPaths = tools.map((tool) => `/tools/${tool.slug}`)
const prerender = ["/", "/about", ...toolPaths]

if (new Set(toolPaths).size !== toolPaths.length) {
  throw new Error("Cannot pre-render: duplicate tool slug")
}

export default {
  future: {
    v8_viteEnvironmentApi: true,
  },
  ssr: false,
  prerender,
} satisfies Config
