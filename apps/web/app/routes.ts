import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("tools/:slug", "routes/tool-detail.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig
