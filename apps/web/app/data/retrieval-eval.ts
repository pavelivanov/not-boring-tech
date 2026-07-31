import type { RetrievalEvalCase } from "@techdex/contracts"

/**
 * Temporary behavior checks, not owner-approved retrieval cases.
 * Replace these with owner-written remembered needs before completing Plan 002.
 */
export const retrievalEvalCases: readonly RetrievalEvalCase[] = [
  {
    query: "open source answer engine",
    expectedToolSlugs: ["perplexica"],
  },
  {
    query: "first ai agent beginner guide",
    expectedToolSlugs: ["build-your-first-ai-agent-guide"],
  },
  {
    query: "local markdown memory",
    expectedToolSlugs: ["mem-agent"],
  },
  {
    query: "app builder",
    expectedToolSlugs: ["lovable"],
  },
  {
    query: "agents workflow",
    expectedToolSlugs: ["langgraph"],
  },
  {
    query: "terminal ai coding agent",
    expectedToolSlugs: ["claude-code"],
  },
  {
    query: "claude code cheat sheet",
    expectedToolSlugs: ["claude-code-cheat-sheet"],
  },
  {
    query: "claude code channels",
    expectedToolSlugs: ["claude-code-channels"],
  },
  {
    query: "karpathy learning project",
    expectedToolSlugs: ["nanochat"],
  },
  {
    query: "claude code skills setup",
    expectedToolSlugs: ["gstack"],
  },
  {
    query: "claude computer use api",
    expectedToolSlugs: ["claude-computer-use"],
  },
  {
    query: "google agents whitepaper",
    expectedToolSlugs: ["google-agents-whitepaper"],
  },
  {
    query: "project catalog ai agents",
    expectedToolSlugs: ["500-ai-agents-projects"],
  },
  {
    query: "image generation collage",
    expectedToolSlugs: ["artbreeder-collage"],
  },
  {
    query: "ai image editing model",
    expectedToolSlugs: ["nano-banana"],
  },
  {
    query: "desktop database client",
    expectedToolSlugs: [
      "tableplus",
      "postico",
      "datagrip",
      "navicat",
      "sequel-pro",
    ],
  },
  {
    query: "browser postgres",
    expectedToolSlugs: ["postgres-new", "pglite"],
  },
  {
    query: "sql csv terminal",
    expectedToolSlugs: ["q"],
  },
  {
    query: "application monitoring",
    expectedToolSlugs: ["datadog"],
  },
  {
    query: "remote pair programming",
    expectedToolSlugs: ["tuple"],
  },
  {
    query: "vite deployment",
    expectedToolSlugs: ["vinext"],
  },
  {
    query: "personal digital security guide",
    expectedToolSlugs: ["surveillance-self-defense"],
  },
]
