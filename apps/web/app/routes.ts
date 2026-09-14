import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("index", "routes/index.tsx"),
  route("about", "routes/about.tsx"),
  route("digest/latest", "routes/digest.tsx", { id: "digest-latest" }),
  route("digest/:id", "routes/digest.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig
