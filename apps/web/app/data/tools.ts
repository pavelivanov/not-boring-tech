import type { Mention, Tool } from "@techdex/contracts"

const initialVerifiedCollectionTime = "2026-07-30T14:36:40.000Z"
const latestVerifiedCollectionTime = "2026-07-30T15:02:17.000Z"

function notBoringMention(
  postId: number,
  publishedAt: string,
  collectedAt = initialVerifiedCollectionTime
): Mention {
  return {
    channelId: "notboring-tech",
    sourceUrl: `https://t.me/notboring_tech/${postId}`,
    publishedAt,
    collectedAt,
  }
}

function ctoDailyMention(postId: number, publishedAt: string): Mention {
  return {
    channelId: "ctodaily",
    sourceUrl: `https://t.me/ctodaily/${postId}`,
    publishedAt,
    collectedAt: latestVerifiedCollectionTime,
  }
}

function mention(
  channelId: string,
  postId: number,
  publishedAt: string
): Mention {
  const collectedAt = new Date(
    new Date(publishedAt).getTime() + 6 * 60 * 60 * 1000
  ).toISOString()

  return {
    channelId,
    sourceUrl: `https://t.me/${channelId.replace("temporary-", "techdex_demo_")}/${postId}`,
    publishedAt,
    collectedAt,
  }
}

/**
 * Mixed verification corpus.
 *
 * Tool identities and canonical URLs are real. Mentions using
 * `notBoringMention` or `ctoDailyMention` were verified against their
 * owner-approved public channels. All mentions created with `mention` remain
 * explicit placeholders. This module must not be treated as a complete
 * provenance corpus or used to mark Plan 002 complete.
 */
export const tools = [
  {
    slug: "cursor",
    name: "Cursor",
    canonicalUrl: "https://www.cursor.com/",
    description:
      "AI code editor with repository-aware chat, inline edits, and agent workflows.",
    category: "AI development",
    tags: ["code editor", "AI assistant", "developer workflow"],
    mentions: [
      ctoDailyMention(1784, "2024-10-30T14:49:48.000Z"),
      notBoringMention(3492, "2025-03-11T08:01:07.000Z"),
      notBoringMention(3500, "2025-03-18T21:55:16.000Z"),
      ctoDailyMention(1848, "2025-06-04T20:43:40.000Z"),
      notBoringMention(3988, "2025-12-12T23:07:00.000Z"),
      notBoringMention(4001, "2025-12-18T22:57:32.000Z"),
      notBoringMention(4082, "2026-02-17T22:15:04.000Z"),
      notBoringMention(4085, "2026-02-23T22:55:09.000Z"),
      notBoringMention(4089, "2026-02-25T23:15:20.000Z"),
    ],
  },
  {
    slug: "claude-code",
    name: "Claude Code",
    canonicalUrl: "https://www.anthropic.com/claude-code",
    description:
      "Terminal AI coding agent that reads, changes, tests, and explains codebases.",
    category: "AI development",
    tags: ["terminal", "AI assistant", "coding agent"],
    mentions: [
      notBoringMention(3700, "2025-08-04T23:01:41.000Z"),
      notBoringMention(4008, "2025-12-21T22:30:27.000Z"),
      ctoDailyMention(1963, "2025-12-29T19:26:49.000Z"),
      ctoDailyMention(1966, "2026-01-03T10:28:26.000Z"),
      ctoDailyMention(1972, "2026-01-09T06:15:33.000Z"),
      ctoDailyMention(1974, "2026-01-09T07:50:42.000Z"),
      ctoDailyMention(1977, "2026-01-12T21:01:57.000Z"),
      ctoDailyMention(2008, "2026-02-07T09:41:05.000Z"),
      notBoringMention(4082, "2026-02-17T22:15:04.000Z"),
      notBoringMention(4085, "2026-02-23T22:55:09.000Z"),
      notBoringMention(4097, "2026-03-02T22:50:11.000Z"),
      notBoringMention(4102, "2026-03-06T23:16:09.000Z"),
      ctoDailyMention(2028, "2026-03-12T11:22:35.000Z"),
      notBoringMention(4107, "2026-03-14T22:42:00.000Z"),
      ctoDailyMention(2032, "2026-03-19T06:41:24.000Z"),
      notBoringMention(4111, "2026-03-20T06:53:54.000Z"),
      notBoringMention(4114, "2026-03-25T07:05:05.000Z"),
      ctoDailyMention(2054, "2026-04-24T06:54:54.000Z"),
    ],
  },
  {
    slug: "github-copilot",
    name: "GitHub Copilot",
    canonicalUrl: "https://github.com/features/copilot",
    description:
      "AI pair programmer for code completion, chat, review, and agentic changes.",
    category: "AI development",
    tags: ["code completion", "AI assistant", "GitHub"],
    mentions: [
      ctoDailyMention(1707, "2023-11-17T07:26:00.000Z"),
      notBoringMention(4082, "2026-02-17T22:15:04.000Z"),
      ctoDailyMention(2085, "2026-06-25T13:24:49.000Z"),
    ],
  },
  {
    slug: "ollama",
    name: "Ollama",
    canonicalUrl: "https://ollama.com/",
    description:
      "Run open language models locally through a small command-line runtime and API.",
    category: "AI development",
    tags: ["local AI", "LLM", "terminal"],
    mentions: [notBoringMention(4099, "2026-03-03T23:53:33.000Z")],
  },
  {
    slug: "langgraph",
    name: "LangGraph",
    canonicalUrl: "https://www.langchain.com/langgraph",
    description:
      "Framework for durable, stateful agent workflows with controllable execution.",
    category: "AI development",
    tags: ["agents", "workflow", "Python"],
    mentions: [
      notBoringMention(
        3456,
        "2025-01-18T21:10:04.000Z",
        latestVerifiedCollectionTime
      ),
      notBoringMention(
        3780,
        "2025-09-08T22:10:29.000Z",
        latestVerifiedCollectionTime
      ),
      ctoDailyMention(1897, "2025-09-09T10:31:53.000Z"),
    ],
  },
  {
    slug: "openai-agents-sdk",
    name: "OpenAI Agents SDK",
    canonicalUrl: "https://openai.github.io/openai-agents-python/",
    description:
      "SDK for tool-using agents with handoffs, guardrails, tracing, and sessions.",
    category: "AI development",
    tags: ["agents", "SDK", "Python"],
    mentions: [mention("temporary-ai", 106, "2026-03-13T13:15:00.000Z")],
  },
  {
    slug: "dify",
    name: "Dify",
    canonicalUrl: "https://dify.ai/",
    description:
      "Open platform for composing, evaluating, and operating generative AI applications.",
    category: "AI development",
    tags: ["low-code", "LLM", "workflow"],
    mentions: [ctoDailyMention(1897, "2025-09-09T10:31:53.000Z")],
  },
  {
    slug: "vllm",
    name: "vLLM",
    canonicalUrl: "https://vllm.ai/",
    description:
      "High-throughput inference and serving engine for open large language models.",
    category: "AI development",
    tags: ["inference", "LLM", "Python"],
    mentions: [
      mention("temporary-ai", 108, "2026-01-08T10:30:00.000Z"),
      mention("temporary-infra", 501, "2026-03-20T06:45:00.000Z"),
    ],
  },
  {
    slug: "playwright",
    name: "Playwright",
    canonicalUrl: "https://playwright.dev/",
    description:
      "Cross-browser automation and end-to-end testing for reliable web applications.",
    category: "Developer tools",
    tags: ["browser automation", "testing", "TypeScript"],
    mentions: [
      notBoringMention(
        3832,
        "2025-09-25T06:15:19.000Z",
        latestVerifiedCollectionTime
      ),
      notBoringMention(
        4176,
        "2026-05-12T09:34:33.000Z",
        latestVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "biome",
    name: "Biome",
    canonicalUrl: "https://biomejs.dev/",
    description:
      "Fast formatter and linter for JavaScript, TypeScript, JSX, JSON, and CSS.",
    category: "Developer tools",
    tags: ["formatter", "linter", "JavaScript"],
    mentions: [mention("temporary-devtools", 207, "2026-01-06T08:35:00.000Z")],
  },
  {
    slug: "bun",
    name: "Bun",
    canonicalUrl: "https://bun.sh/",
    description:
      "Fast JavaScript runtime, package manager, test runner, and application bundler.",
    category: "Developer tools",
    tags: ["JavaScript", "runtime", "package manager"],
    mentions: [mention("temporary-devtools", 208, "2025-09-21T14:10:00.000Z")],
  },
  {
    slug: "pnpm",
    name: "pnpm",
    canonicalUrl: "https://pnpm.io/",
    description:
      "Disk-efficient JavaScript package manager with strict dependency isolation.",
    category: "Developer tools",
    tags: ["JavaScript", "package manager", "monorepo"],
    mentions: [mention("temporary-devtools", 209, "2025-08-18T07:30:00.000Z")],
  },
  {
    slug: "turborepo",
    name: "Turborepo",
    canonicalUrl: "https://turborepo.com/",
    description:
      "High-performance build system for JavaScript and TypeScript monorepositories.",
    category: "Developer tools",
    tags: ["monorepo", "build system", "TypeScript"],
    mentions: [mention("temporary-devtools", 210, "2025-12-03T10:40:00.000Z")],
  },
  {
    slug: "zed",
    name: "Zed",
    canonicalUrl: "https://zed.dev/",
    description:
      "Fast collaborative code editor built in Rust with integrated AI assistance.",
    category: "Developer tools",
    tags: ["code editor", "Rust", "collaboration"],
    mentions: [mention("temporary-devtools", 211, "2026-02-11T15:50:00.000Z")],
  },
  {
    slug: "mise",
    name: "mise",
    canonicalUrl: "https://mise.jdx.dev/",
    description:
      "Polyglot tool-version manager and task runner for reproducible development environments.",
    category: "Developer tools",
    tags: ["terminal", "version manager", "developer workflow"],
    mentions: [mention("temporary-devtools", 212, "2025-11-05T11:00:00.000Z")],
  },
  {
    slug: "ngrok",
    name: "ngrok",
    canonicalUrl: "https://ngrok.com/",
    description:
      "Secure public endpoints and traffic inspection for local development services.",
    category: "Developer tools",
    tags: ["tunneling", "local development", "networking"],
    mentions: [ctoDailyMention(5, "2016-08-16T16:21:42.000Z")],
  },
  {
    slug: "bruno",
    name: "Bruno",
    canonicalUrl: "https://www.usebruno.com/",
    description:
      "Offline-first API client that stores plain-text collections alongside source code.",
    category: "Developer tools",
    tags: ["API client", "offline", "Git"],
    mentions: [mention("temporary-devtools", 214, "2026-01-25T13:05:00.000Z")],
  },
  {
    slug: "hoppscotch",
    name: "Hoppscotch",
    canonicalUrl: "https://hoppscotch.io/",
    description:
      "Open-source web API client for REST, GraphQL, realtime, and collaboration.",
    category: "Developer tools",
    tags: ["API client", "open source", "GraphQL"],
    mentions: [mention("temporary-devtools", 215, "2025-12-28T16:20:00.000Z")],
  },
  {
    slug: "postgresql",
    name: "PostgreSQL",
    canonicalUrl: "https://www.postgresql.org/",
    description:
      "Extensible relational database with strong SQL support and a mature ecosystem.",
    category: "Data systems",
    tags: ["database", "SQL", "open source"],
    mentions: [ctoDailyMention(1998, "2026-02-04T22:07:06.000Z")],
  },
  {
    slug: "duckdb",
    name: "DuckDB",
    canonicalUrl: "https://duckdb.org/",
    description:
      "Fast embedded analytical database for querying local files and in-process data.",
    category: "Data systems",
    tags: ["analytics", "embedded", "SQL"],
    mentions: [
      mention("temporary-data", 302, "2025-10-04T10:10:00.000Z"),
      mention("temporary-devtools", 216, "2026-02-22T12:45:00.000Z"),
    ],
  },
  {
    slug: "clickhouse",
    name: "ClickHouse",
    canonicalUrl: "https://clickhouse.com/",
    description:
      "Column-oriented SQL database for real-time analytics at high ingest volumes.",
    category: "Data systems",
    tags: ["analytics", "columnar", "SQL"],
    mentions: [
      ctoDailyMention(1530, "2022-04-01T13:17:12.000Z"),
      ctoDailyMention(1683, "2023-05-19T12:02:03.000Z"),
      ctoDailyMention(1690, "2023-06-29T05:41:15.000Z"),
    ],
  },
  {
    slug: "qdrant",
    name: "Qdrant",
    canonicalUrl: "https://qdrant.tech/",
    description:
      "Vector database and similarity-search engine designed for AI applications.",
    category: "Data systems",
    tags: ["vector database", "similarity search", "Rust"],
    mentions: [
      mention("temporary-data", 304, "2026-01-17T11:30:00.000Z"),
      mention("temporary-ai", 109, "2026-03-01T08:20:00.000Z"),
    ],
  },
  {
    slug: "supabase",
    name: "Supabase",
    canonicalUrl: "https://supabase.com/",
    description:
      "Hosted Postgres platform with authentication, storage, realtime, and edge functions.",
    category: "Data systems",
    tags: ["Postgres", "backend as a service", "serverless"],
    mentions: [
      ctoDailyMention(1670, "2023-02-06T07:13:02.000Z"),
      ctoDailyMention(1770, "2024-08-14T10:38:26.000Z"),
    ],
  },
  {
    slug: "neon",
    name: "Neon",
    canonicalUrl: "https://neon.com/",
    description:
      "Serverless hosted Postgres with branching, autoscaling, and separated storage.",
    category: "Data systems",
    tags: ["Postgres", "serverless", "database"],
    mentions: [
      mention("temporary-data", 306, "2025-12-07T09:35:00.000Z"),
      mention("temporary-infra", 502, "2026-02-09T17:00:00.000Z"),
    ],
  },
  {
    slug: "pocketbase",
    name: "PocketBase",
    canonicalUrl: "https://pocketbase.io/",
    description:
      "Single-file backend with embedded database, authentication, files, and realtime.",
    category: "Data systems",
    tags: ["backend as a service", "embedded", "Go"],
    mentions: [mention("temporary-data", 307, "2026-01-29T12:10:00.000Z")],
  },
  {
    slug: "prisma",
    name: "Prisma",
    canonicalUrl: "https://www.prisma.io/",
    description:
      "Type-safe ORM and migration toolkit for TypeScript database applications.",
    category: "Data systems",
    tags: ["ORM", "TypeScript", "database"],
    mentions: [mention("temporary-data", 308, "2025-11-14T07:50:00.000Z")],
  },
  {
    slug: "tailwind-css",
    name: "Tailwind CSS",
    canonicalUrl: "https://tailwindcss.com/",
    description:
      "Utility-first CSS framework that generates styles from application source files.",
    category: "Frontend",
    tags: ["CSS", "design system", "frontend"],
    mentions: [mention("temporary-frontend", 402, "2025-07-28T13:00:00.000Z")],
  },
  {
    slug: "shadcn-ui",
    name: "shadcn/ui",
    canonicalUrl: "https://ui.shadcn.com/",
    description:
      "Accessible UI components distributed as editable source for application design systems.",
    category: "Frontend",
    tags: ["UI components", "accessibility", "design system"],
    mentions: [
      mention("temporary-frontend", 403, "2025-10-22T09:10:00.000Z"),
      mention("temporary-devtools", 217, "2026-01-31T16:30:00.000Z"),
    ],
  },
  {
    slug: "storybook",
    name: "Storybook",
    canonicalUrl: "https://storybook.js.org/",
    description:
      "Workshop for developing and documenting UI components in isolation.",
    category: "Frontend",
    tags: ["UI components", "documentation", "testing"],
    mentions: [mention("temporary-frontend", 404, "2025-09-08T08:30:00.000Z")],
  },
  {
    slug: "vite",
    name: "Vite",
    canonicalUrl: "https://vite.dev/",
    description:
      "Fast frontend development server and optimized production build tool.",
    category: "Frontend",
    tags: ["build system", "frontend", "JavaScript"],
    mentions: [ctoDailyMention(2022, "2026-02-25T14:00:42.000Z")],
  },
  {
    slug: "astro",
    name: "Astro",
    canonicalUrl: "https://astro.build/",
    description:
      "Web framework for fast static content sites with component islands.",
    category: "Frontend",
    tags: ["static site", "web framework", "content"],
    mentions: [mention("temporary-frontend", 406, "2025-12-19T11:45:00.000Z")],
  },
  {
    slug: "react-router",
    name: "React Router",
    canonicalUrl: "https://reactrouter.com/",
    description:
      "Routing library and full-stack framework for building React applications.",
    category: "Frontend",
    tags: ["React", "routing", "web framework"],
    mentions: [mention("temporary-frontend", 407, "2026-01-10T10:15:00.000Z")],
  },
  {
    slug: "docker",
    name: "Docker",
    canonicalUrl: "https://www.docker.com/",
    description:
      "Container tooling for packaging and running applications consistently.",
    category: "Infrastructure",
    tags: ["containers", "deployment", "developer workflow"],
    mentions: [
      ctoDailyMention(1303, "2021-04-16T10:43:25.000Z"),
      ctoDailyMention(1745, "2024-05-30T08:26:05.000Z"),
      ctoDailyMention(1783, "2024-10-25T14:02:21.000Z"),
      notBoringMention(3620, "2025-06-13T22:01:16.000Z"),
    ],
  },
  {
    slug: "railway",
    name: "Railway",
    canonicalUrl: "https://railway.com/",
    description:
      "Application deployment platform with managed services, databases, and environments.",
    category: "Infrastructure",
    tags: ["deployment", "hosting", "platform as a service"],
    mentions: [mention("temporary-infra", 504, "2025-11-27T14:40:00.000Z")],
  },
  {
    slug: "render",
    name: "Render",
    canonicalUrl: "https://render.com/",
    description:
      "Cloud platform for hosting web services, workers, static sites, and databases.",
    category: "Infrastructure",
    tags: ["deployment", "hosting", "platform as a service"],
    mentions: [mention("temporary-infra", 505, "2025-10-17T07:25:00.000Z")],
  },
  {
    slug: "tailscale",
    name: "Tailscale",
    canonicalUrl: "https://tailscale.com/",
    description:
      "Private mesh network built on WireGuard for connecting people and machines.",
    category: "Infrastructure",
    tags: ["networking", "VPN", "security"],
    mentions: [mention("temporary-infra", 506, "2025-12-13T12:35:00.000Z")],
  },
  {
    slug: "sentry",
    name: "Sentry",
    canonicalUrl: "https://sentry.io/",
    description:
      "Application error monitoring, performance tracing, and debugging context.",
    category: "Operations",
    tags: ["monitoring", "errors", "observability"],
    mentions: [mention("temporary-infra", 507, "2025-09-30T16:05:00.000Z")],
  },
  {
    slug: "semgrep",
    name: "Semgrep",
    canonicalUrl: "https://semgrep.dev/",
    description:
      "Static analysis for finding security issues and enforcing code rules.",
    category: "Security",
    tags: ["static analysis", "security", "developer workflow"],
    mentions: [mention("temporary-infra", 508, "2026-02-18T08:55:00.000Z")],
  },
  {
    slug: "1password-cli",
    name: "1Password CLI",
    canonicalUrl: "https://developer.1password.com/docs/cli/",
    description:
      "Command-line access to secrets, vault items, and secure development workflows.",
    category: "Security",
    tags: ["secrets", "terminal", "security"],
    mentions: [mention("temporary-infra", 509, "2025-11-02T13:30:00.000Z")],
  },
  {
    slug: "obsidian",
    name: "Obsidian",
    canonicalUrl: "https://obsidian.md/",
    description:
      "Local-first Markdown notes with links, plugins, and a visual knowledge graph.",
    category: "Productivity",
    tags: ["notes", "local-first", "Markdown"],
    mentions: [
      notBoringMention(
        3797,
        "2025-09-13T22:37:46.000Z",
        latestVerifiedCollectionTime
      ),
      notBoringMention(
        4031,
        "2026-01-05T23:01:18.000Z",
        latestVerifiedCollectionTime
      ),
    ],
  },
] as const satisfies readonly Tool[]

export const toolsBySlug: ReadonlyMap<string, Tool> = new Map(
  tools.map((tool) => [tool.slug, tool])
)

export const categories = [...new Set(tools.map((tool) => tool.category))].sort(
  (left, right) => left.localeCompare(right)
)

export const tags = [...new Set(tools.flatMap((tool) => tool.tags))].sort(
  (left, right) => left.localeCompare(right)
)
