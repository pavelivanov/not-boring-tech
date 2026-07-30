import type { RetrievalEvalCase } from "@techdex/contracts"

/**
 * Temporary behavior checks, not owner-approved retrieval cases.
 * Replace these alongside the temporary corpus before completing Plan 002.
 */
export const retrievalEvalCases = [
  {
    query: "run models locally",
    expectedToolSlugs: ["ollama"],
  },
  {
    query: "browser automation testing",
    expectedToolSlugs: ["playwright"],
  },
  {
    query: "fast embedded analytics database",
    expectedToolSlugs: ["duckdb"],
  },
  {
    query: "serverless hosted postgres",
    expectedToolSlugs: ["neon"],
  },
  {
    query: "accessible ui components",
    expectedToolSlugs: ["shadcn-ui"],
  },
  {
    query: "terminal ai coding agent",
    expectedToolSlugs: ["claude-code"],
  },
  {
    query: "javascript formatter linter",
    expectedToolSlugs: ["biome"],
  },
  {
    query: "vector database",
    expectedToolSlugs: ["qdrant"],
  },
  {
    query: "offline api client",
    expectedToolSlugs: ["bruno"],
  },
  {
    query: "typescript orm",
    expectedToolSlugs: ["prisma"],
  },
  {
    query: "private network vpn",
    expectedToolSlugs: ["tailscale"],
  },
  {
    query: "error monitoring",
    expectedToolSlugs: ["sentry"],
  },
  {
    query: "static content site",
    expectedToolSlugs: ["astro"],
  },
  {
    query: "fast javascript runtime",
    expectedToolSlugs: ["bun"],
  },
  {
    query: "application deployment platform",
    tags: ["deployment"],
    expectedToolSlugs: ["railway", "render"],
  },
] as const satisfies readonly RetrievalEvalCase[]
