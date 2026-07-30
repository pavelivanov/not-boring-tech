import type { Mention, Tool } from "@techdex/contracts"

const initialVerifiedCollectionTime = "2026-07-30T14:36:40.000Z"
const latestVerifiedCollectionTime = "2026-07-30T15:02:17.000Z"
const replacementVerifiedCollectionTime = "2026-07-30T15:23:42.000Z"
const finalVerifiedCollectionTime = "2026-07-30T15:31:48.000Z"

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

function ctoDailyMention(
  postId: number,
  publishedAt: string,
  collectedAt = latestVerifiedCollectionTime
): Mention {
  return {
    channelId: "ctodaily",
    sourceUrl: `https://t.me/ctodaily/${postId}`,
    publishedAt,
    collectedAt,
  }
}

/**
 * Verified provisional corpus.
 *
 * Tool identities and canonical URLs are real. Mentions using
 * `notBoringMention` or `ctoDailyMention` were verified against their
 * owner-approved public channels. The final tool selection and retrieval
 * expectations still require owner approval before Plan 002 can be complete.
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
    slug: "mem-agent",
    name: "mem-agent",
    canonicalUrl: "https://github.com/firstbatchxyz/mem-agent-mcp",
    description:
      "Local memory agent and MCP server that connects conversations and documents into editable Markdown memory.",
    category: "AI development",
    tags: ["memory", "MCP", "local AI"],
    mentions: [
      notBoringMention(
        3797,
        "2025-09-13T22:37:46.000Z",
        replacementVerifiedCollectionTime
      ),
    ],
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
    slug: "lm-studio",
    name: "LM Studio",
    canonicalUrl: "https://lmstudio.ai/",
    description:
      "Desktop runtime and agent environment for downloading and using open models locally.",
    category: "AI development",
    tags: ["local AI", "LLM", "desktop"],
    mentions: [
      notBoringMention(
        3797,
        "2025-09-13T22:37:46.000Z",
        finalVerifiedCollectionTime
      ),
      notBoringMention(
        4176,
        "2026-05-12T09:34:33.000Z",
        finalVerifiedCollectionTime
      ),
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
    slug: "nano-banana",
    name: "Nano Banana",
    canonicalUrl:
      "https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image",
    description:
      "Google image-generation and editing model for prompt-driven visual creation.",
    category: "Creative AI",
    tags: ["image generation", "image editing", "Gemini"],
    mentions: [
      notBoringMention(
        3758,
        "2025-08-30T23:31:04.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "stable-diffusion",
    name: "Stable Diffusion",
    canonicalUrl: "https://stability.ai/stable-image",
    description:
      "Diffusion-model family for generating and transforming images from text prompts.",
    category: "Creative AI",
    tags: ["image generation", "diffusion", "creative tool"],
    mentions: [
      notBoringMention(
        2520,
        "2022-11-16T11:59:43.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "q",
    name: "q",
    canonicalUrl: "https://github.com/harelba/q",
    description:
      "Command-line tool for running SQL directly against CSV and other delimited files.",
    category: "Developer tools",
    tags: ["SQL", "CSV", "terminal"],
    mentions: [
      ctoDailyMention(
        434,
        "2017-12-11T17:05:58.000Z",
        replacementVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "tableplus",
    name: "TablePlus",
    canonicalUrl: "https://tableplus.com/",
    description:
      "Native desktop database client with a query editor and support for multiple relational databases.",
    category: "Developer tools",
    tags: ["database client", "SQL", "desktop"],
    mentions: [
      ctoDailyMention(
        524,
        "2018-02-12T08:41:28.000Z",
        replacementVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "crewai",
    name: "CrewAI",
    canonicalUrl: "https://crewai.com/",
    description:
      "Build and runtime platform for orchestrating role-based AI agents and workflows.",
    category: "AI development",
    tags: ["agents", "multi-agent", "workflow"],
    mentions: [
      notBoringMention(
        3780,
        "2025-09-08T22:10:29.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "postico",
    name: "Postico 2",
    canonicalUrl: "https://eggerapps.at/postico2/",
    description:
      "Native macOS client for browsing, querying, and editing PostgreSQL databases.",
    category: "Developer tools",
    tags: ["database client", "Postgres", "macOS"],
    mentions: [
      ctoDailyMention(
        525,
        "2018-02-12T16:38:01.000Z",
        replacementVerifiedCollectionTime
      ),
    ],
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
    slug: "autogen",
    name: "AutoGen",
    canonicalUrl: "https://microsoft.github.io/autogen/stable/",
    description:
      "Framework for prototyping conversational, event-driven, and multi-agent AI applications.",
    category: "AI development",
    tags: ["agents", "multi-agent", "Python"],
    mentions: [
      notBoringMention(
        3780,
        "2025-09-08T22:10:29.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "postgres-new",
    name: "Postgres.new",
    canonicalUrl: "https://postgres.new/",
    description:
      "In-browser PostgreSQL workspace for loading data, asking questions, and learning SQL.",
    category: "Data systems",
    tags: ["Postgres", "browser", "SQL"],
    mentions: [
      ctoDailyMention(
        1770,
        "2024-08-14T10:38:26.000Z",
        replacementVerifiedCollectionTime
      ),
    ],
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
    slug: "langchain",
    name: "LangChain",
    canonicalUrl: "https://www.langchain.com/",
    description:
      "Framework and platform for building, testing, and operating language-model applications.",
    category: "AI development",
    tags: ["agents", "framework", "Python"],
    mentions: [
      notBoringMention(
        3456,
        "2025-01-18T21:10:04.000Z",
        finalVerifiedCollectionTime
      ),
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
    slug: "puppeteer",
    name: "Puppeteer",
    canonicalUrl: "https://pptr.dev/",
    description:
      "JavaScript library for controlling Chrome and Firefox through a high-level browser API.",
    category: "Developer tools",
    tags: ["browser automation", "testing", "JavaScript"],
    mentions: [
      notBoringMention(
        3832,
        "2025-09-25T06:15:19.000Z",
        finalVerifiedCollectionTime
      ),
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
    slug: "figma",
    name: "Figma",
    canonicalUrl: "https://www.figma.com/",
    description:
      "Collaborative design canvas for interface design, prototyping, and shared component systems.",
    category: "Design",
    tags: ["design", "collaboration", "prototyping"],
    mentions: [
      ctoDailyMention(
        1253,
        "2021-02-13T19:08:33.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "lovable",
    name: "Lovable",
    canonicalUrl: "https://lovable.dev/",
    description:
      "Prompt-driven app builder for producing working web prototypes and applications.",
    category: "AI development",
    tags: ["app builder", "vibe coding", "prototyping"],
    mentions: [
      ctoDailyMention(
        1883,
        "2025-08-15T10:48:10.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "datagrip",
    name: "DataGrip",
    canonicalUrl: "https://www.jetbrains.com/datagrip/",
    description:
      "Cross-platform database IDE with schema navigation, query tools, and SQL assistance.",
    category: "Developer tools",
    tags: ["database client", "SQL", "IDE"],
    mentions: [
      ctoDailyMention(
        525,
        "2018-02-12T16:38:01.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "vinext",
    name: "vinext",
    canonicalUrl: "https://github.com/cloudflare/vinext",
    description:
      "Vite plugin that reimplements the Next.js API surface for deployment across runtimes.",
    category: "Frontend",
    tags: ["Vite", "Next.js", "deployment"],
    mentions: [
      ctoDailyMention(
        2022,
        "2026-02-25T14:00:42.000Z",
        replacementVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "navicat",
    name: "Navicat",
    canonicalUrl: "https://www.navicat.com/en/products",
    description:
      "Cross-platform database administration suite for relational and document databases.",
    category: "Developer tools",
    tags: ["database client", "SQL", "desktop"],
    mentions: [
      ctoDailyMention(
        525,
        "2018-02-12T16:38:01.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "artbreeder-collage",
    name: "Artbreeder Collage",
    canonicalUrl: "https://collage.artbreeder.com/",
    description:
      "Creative AI canvas that turns assembled image collages and text prompts into generated scenes.",
    category: "Creative AI",
    tags: ["image generation", "collage", "creative tool"],
    mentions: [
      notBoringMention(
        2338,
        "2022-07-17T08:16:04.000Z",
        replacementVerifiedCollectionTime
      ),
    ],
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
    slug: "tuple",
    name: "Tuple",
    canonicalUrl: "https://tuple.app/",
    description:
      "Low-latency screen sharing and remote control designed for pair programming.",
    category: "Developer tools",
    tags: ["pair programming", "screen sharing", "collaboration"],
    mentions: [
      ctoDailyMention(
        1253,
        "2021-02-13T19:08:33.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "sloplobster",
    name: "SlopLobster",
    canonicalUrl: "https://github.com/PasiKoodaa/SlopLobster",
    description:
      "Local browser-based AI coding agent with file, shell, web, and browser automation tools.",
    category: "AI development",
    tags: ["coding agent", "local AI", "browser"],
    mentions: [
      notBoringMention(
        4176,
        "2026-05-12T09:34:33.000Z",
        replacementVerifiedCollectionTime
      ),
    ],
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
    slug: "open-interpreter",
    name: "Open Interpreter",
    canonicalUrl: "https://www.openinterpreter.com/",
    description:
      "Local coding agent that lets language models run code and operate a computer.",
    category: "AI development",
    tags: ["coding agent", "computer use", "local AI"],
    mentions: [
      ctoDailyMention(
        1783,
        "2024-10-25T14:02:21.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "pglite",
    name: "PGlite",
    canonicalUrl: "https://pglite.dev/",
    description:
      "WASM build of Postgres packaged for embedded use in browsers and JavaScript runtimes.",
    category: "Data systems",
    tags: ["Postgres", "WASM", "embedded", "browser"],
    mentions: [
      ctoDailyMention(
        1769,
        "2024-08-14T10:36:31.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "datadog",
    name: "Datadog",
    canonicalUrl: "https://www.datadoghq.com/",
    description:
      "Observability platform for metrics, logs, traces, dashboards, and application monitoring.",
    category: "Operations",
    tags: ["monitoring", "APM", "observability"],
    mentions: [
      ctoDailyMention(
        1119,
        "2020-03-19T21:00:01.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "bugsnag",
    name: "Bugsnag",
    canonicalUrl: "https://www.bugsnag.com/",
    description:
      "Application stability platform for error monitoring, diagnostics, and performance insights.",
    category: "Operations",
    tags: ["monitoring", "errors", "observability"],
    mentions: [
      ctoDailyMention(
        62,
        "2016-12-22T16:55:34.000Z",
        finalVerifiedCollectionTime
      ),
      ctoDailyMention(
        1118,
        "2020-03-18T16:31:55.000Z",
        finalVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "pyspur",
    name: "PySpur",
    canonicalUrl: "https://www.pyspur.com/",
    description:
      "Visual AI agent builder for graph workflows, debugging, evaluation, and self-hosting.",
    category: "AI development",
    tags: ["agents", "low-code", "workflow"],
    mentions: [
      ctoDailyMention(
        1897,
        "2025-09-09T10:31:53.000Z",
        replacementVerifiedCollectionTime
      ),
    ],
  },
  {
    slug: "1password",
    name: "1Password",
    canonicalUrl: "https://1password.com/",
    description:
      "Password and secrets manager for storing credentials, passkeys, and secure access.",
    category: "Security",
    tags: ["password manager", "secrets", "security"],
    mentions: [
      ctoDailyMention(
        570,
        "2018-03-02T12:29:04.000Z",
        replacementVerifiedCollectionTime
      ),
    ],
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
