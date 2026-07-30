import type { RetrievalEvalCase } from "@techdex/contracts"

/**
 * Temporary behavior checks, not owner-approved retrieval cases.
 * Replace these with owner-written remembered needs before completing Plan 002.
 */
export const retrievalEvalCases: readonly RetrievalEvalCase[] = [
  {
    query: "run models locally",
    expectedToolSlugs: ["ollama", "lm-studio"],
  },
  {
    query: "browser automation testing",
    expectedToolSlugs: ["playwright", "puppeteer"],
  },
  {
    query: "local markdown memory",
    expectedToolSlugs: ["mem-agent", "obsidian"],
  },
  {
    query: "app builder",
    expectedToolSlugs: ["lovable"],
  },
  {
    query: "agents workflow",
    expectedToolSlugs: ["crewai", "langgraph"],
  },
  {
    query: "terminal ai coding agent",
    expectedToolSlugs: ["claude-code"],
  },
  {
    query: "image generation collage",
    expectedToolSlugs: ["artbreeder-collage"],
  },
  {
    query: "ai image editing model",
    expectedToolSlugs: ["nano-banana", "stable-diffusion"],
  },
  {
    query: "desktop database client",
    expectedToolSlugs: ["tableplus", "postico", "datagrip", "navicat"],
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
    query: "application error monitoring",
    expectedToolSlugs: ["bugsnag", "datadog"],
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
    query: "password manager",
    expectedToolSlugs: ["1password"],
  },
]
