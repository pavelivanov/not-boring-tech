import type { Mention, Tool } from "@techdex/contracts"

const initialVerifiedCollectionTime = "2026-07-30T14:36:40.000Z"
const latestVerifiedCollectionTime = "2026-07-30T15:02:17.000Z"
const replacementVerifiedCollectionTime = "2026-07-30T15:23:42.000Z"
const finalVerifiedCollectionTime = "2026-07-30T15:31:48.000Z"
const subjectAuditCollectionTime = "2026-07-31T09:12:56.000Z"

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
 * owner-approved public channels. The final subject selection and retrieval
 * expectations still require owner approval before Plan 002 can be complete.
 */
export const tools: readonly Tool[] = [
  {
    slug: "cursor",
    name: "Cursor",
    kind: "TOOL",
    canonicalUrl: "https://www.cursor.com/",
    description:
      "AI code editor with repository-aware chat, inline edits, and agent workflows.",
    category: "AI development",
    tags: ["code editor", "AI assistant", "developer workflow"],
    mentions: [ctoDailyMention(1784, "2024-10-30T14:49:48.000Z")],
  },
  {
    slug: "claude-code",
    name: "Claude Code",
    kind: "TOOL",
    canonicalUrl: "https://www.anthropic.com/claude-code",
    description:
      "Terminal AI coding agent that reads, changes, tests, and explains codebases.",
    category: "AI development",
    tags: ["terminal", "AI assistant", "coding agent"],
    mentions: [
      ctoDailyMention(
        1966,
        "2026-01-03T10:28:26.000Z",
        subjectAuditCollectionTime
      ),
      ctoDailyMention(
        1972,
        "2026-01-09T06:15:33.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "claude-code-templates",
    name: "Claude Code Templates",
    kind: "PROJECT",
    canonicalUrl: "https://davila7.github.io/claude-code-templates/",
    description:
      "Open collection of agents, commands, settings, hooks, and templates for configuring Claude Code.",
    category: "AI development",
    tags: ["Claude Code", "configuration", "templates"],
    mentions: [
      notBoringMention(
        3700,
        "2025-08-04T23:01:41.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "claude-code-project-guide",
    name: "Claude Code Project Guide",
    kind: "GUIDE",
    canonicalUrl: "https://www.youtube.com/watch?v=aQvpqlSiUIQ",
    description:
      "Video walkthrough of installing, configuring, and using Claude Code through a complete project workflow.",
    category: "Learning resources",
    tags: ["Claude Code", "video guide", "developer workflow"],
    mentions: [
      notBoringMention(
        4008,
        "2025-12-21T22:30:27.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "opencode",
    name: "OpenCode",
    kind: "TOOL",
    canonicalUrl: "https://github.com/anomalyco/opencode",
    description:
      "Open-source coding agent for working with software projects from a terminal interface.",
    category: "AI development",
    tags: ["coding agent", "terminal", "open source"],
    mentions: [
      ctoDailyMention(
        1974,
        "2026-01-09T07:50:42.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "oh-my-opencode",
    name: "Oh My OpenCode",
    kind: "PLUGIN",
    canonicalUrl: "https://github.com/code-yeongyu/oh-my-opencode",
    description:
      "Agent orchestration and workflow extension that adds batteries-included behavior to OpenCode.",
    category: "AI development",
    tags: ["OpenCode", "agents", "developer workflow"],
    mentions: [
      ctoDailyMention(
        1974,
        "2026-01-09T07:50:42.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "cowork",
    name: "Cowork",
    kind: "PRODUCT",
    canonicalUrl: "https://claude.com/blog/cowork-research-preview",
    description:
      "Claude research-preview workspace for delegating non-coding tasks that operate on local files.",
    category: "AI productivity",
    tags: ["Claude", "desktop agent", "file automation"],
    mentions: [
      ctoDailyMention(
        1977,
        "2026-01-12T21:01:57.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "claude-code-agent-teams",
    name: "Claude Code Agent Teams",
    kind: "FEATURE",
    parentName: "Claude Code",
    canonicalUrl: "https://code.claude.com/docs/en/agent-teams",
    description:
      "Claude Code feature for coordinating multiple independent agent sessions that communicate and share tasks.",
    category: "AI development",
    tags: ["Claude Code", "multi-agent", "coordination"],
    mentions: [
      ctoDailyMention(
        2008,
        "2026-02-07T09:41:05.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "antigravity-awesome-skills",
    name: "Antigravity Awesome Skills",
    kind: "PROJECT",
    canonicalUrl: "https://github.com/sickn33/antigravity-awesome-skills",
    description:
      "Open collection of reusable agent skills for coding, research, design, and other development workflows.",
    category: "AI development",
    tags: ["agent skills", "skills", "developer workflow"],
    mentions: [
      notBoringMention(
        4082,
        "2026-02-17T22:15:04.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "hugging-face-skills",
    name: "Hugging Face Skills",
    kind: "PLUGIN",
    canonicalUrl: "https://github.com/huggingface/skills",
    description:
      "Hugging Face-maintained skills that teach coding agents to work with models, datasets, and Hub workflows.",
    category: "AI development",
    tags: ["agent skills", "Hugging Face", "plugin"],
    mentions: [
      notBoringMention(
        4085,
        "2026-02-23T22:55:09.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "claude-code-best-practice",
    name: "Claude Code Best Practice",
    kind: "GUIDE",
    canonicalUrl: "https://github.com/shanraisshan/claude-code-best-practice",
    description:
      "Structured reference for Claude Code setup, configuration, commands, workflows, and operational practices.",
    category: "Learning resources",
    tags: ["Claude Code", "best practices", "reference"],
    mentions: [
      notBoringMention(
        4097,
        "2026-03-02T22:50:11.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "claude-code-skill-creator",
    name: "Claude Code Skill Creator",
    kind: "PLUGIN",
    canonicalUrl:
      "https://github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator",
    description:
      "Official Claude Code plugin for creating, evaluating, and improving reusable agent skills.",
    category: "AI development",
    tags: ["Claude Code", "agent skills", "plugin"],
    mentions: [
      notBoringMention(
        4102,
        "2026-03-06T23:16:09.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "nanochat",
    name: "nanochat",
    kind: "PROJECT",
    canonicalUrl: "https://github.com/karpathy/nanochat",
    description:
      "Compact learning project by Karpathy for training and running a ChatGPT-style language model end to end.",
    category: "Learning resources",
    tags: ["LLM", "education", "training"],
    mentions: [
      ctoDailyMention(
        2028,
        "2026-03-12T11:22:35.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "gstack",
    name: "gstack",
    kind: "PROJECT",
    canonicalUrl: "https://github.com/garrytan/gstack",
    description:
      "Garry Tan's opinionated collection of Claude Code skills for planning, building, reviewing, testing, and shipping software.",
    category: "AI development",
    tags: ["Claude Code", "skills setup", "developer workflow"],
    mentions: [
      notBoringMention(
        4107,
        "2026-03-14T22:42:00.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "claude-code-technical-audit-guide",
    name: "Claude Code Technical Audit Guide",
    kind: "GUIDE",
    canonicalUrl:
      "https://gist.github.com/gsamat/d2aeb4eaa79260bc5f85ec9056296596",
    description:
      "Reusable workflow for investigating a large legacy system with Claude Code and leaving an explorable audit knowledge base.",
    category: "Learning resources",
    tags: ["Claude Code", "technical audit", "workflow"],
    mentions: [
      ctoDailyMention(
        2032,
        "2026-03-19T06:41:24.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "claude-code-channels",
    name: "Claude Code Channels",
    kind: "FEATURE",
    parentName: "Claude Code",
    canonicalUrl:
      "https://github.com/anthropics/claude-plugins-official/blob/main/external_plugins/telegram/README.md",
    description:
      "Claude Code feature for controlling local agent sessions remotely through channel integrations such as Telegram and Discord.",
    category: "AI development",
    tags: ["Claude Code", "Telegram", "remote control"],
    mentions: [
      notBoringMention(
        4111,
        "2026-03-20T06:53:54.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "claude-code-cheat-sheet",
    name: "Claude Code Cheat Sheet",
    kind: "CHEAT_SHEET",
    canonicalUrl: "https://cc.storyfox.cz/",
    description:
      "Continuously updated shortcut and command reference for Claude Code on macOS and Windows.",
    category: "Learning resources",
    tags: ["Claude Code", "cheat sheet", "reference"],
    mentions: [
      notBoringMention(
        4114,
        "2026-03-25T07:05:05.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "claude-computer-use",
    name: "Claude Computer Use",
    kind: "FEATURE",
    parentName: "Claude",
    canonicalUrl:
      "https://docs.anthropic.com/en/docs/build-with-claude/computer-use",
    description:
      "Claude feature for seeing a computer screen and operating its mouse and keyboard through an API.",
    category: "AI development",
    tags: ["Claude", "computer use", "API"],
    mentions: [
      ctoDailyMention(
        1783,
        "2024-10-25T14:02:21.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "google-agents-whitepaper",
    name: "Google Agents Whitepaper",
    kind: "GUIDE",
    canonicalUrl: "https://www.kaggle.com/whitepaper-agents",
    description:
      "Google's concise technical introduction to AI-agent components, architectures, tools, and learning approaches.",
    category: "Learning resources",
    tags: ["AI agents", "whitepaper", "architecture"],
    mentions: [
      notBoringMention(
        3456,
        "2025-01-18T21:10:04.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "500-ai-agents-projects",
    name: "500 AI Agents Projects",
    kind: "PROJECT",
    canonicalUrl: "https://github.com/ashishpatel26/500-AI-Agents-Projects",
    description:
      "Large catalog of practical AI-agent use cases with linked source repositories and notebooks.",
    category: "Learning resources",
    tags: ["AI agents", "examples", "project collection"],
    mentions: [
      notBoringMention(
        3780,
        "2025-09-08T22:10:29.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "build-your-first-ai-agent-guide",
    name: "Build Your First AI Agent Guide",
    kind: "GUIDE",
    canonicalUrl:
      "https://www.reddit.com/r/AgentsOfAI/comments/1mwof0j/building_your_first_ai_agent_a_clear_path/",
    description:
      "Practical beginner guide for scoping, wiring, testing, and iterating on a first AI agent.",
    category: "Learning resources",
    tags: ["AI agents", "beginner guide", "workflow"],
    mentions: [
      notBoringMention(
        3832,
        "2025-09-25T06:15:19.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "sequel-pro",
    name: "Sequel Pro",
    kind: "TOOL",
    canonicalUrl: "https://www.sequelpro.com/",
    description:
      "Open-source macOS client for browsing, querying, and managing MySQL databases.",
    category: "Developer tools",
    tags: ["database client", "MySQL", "macOS"],
    mentions: [
      ctoDailyMention(
        525,
        "2018-02-12T16:38:01.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "clickhouse-podcast",
    name: "ClickHouse Podcast Episode",
    kind: "PODCAST",
    canonicalUrl: "https://zapuskzavtra.libsyn.com/clickhouse",
    description:
      "Interview with ClickHouse creator Alexey Milovidov about the analytics database's path from experiment to company.",
    category: "Learning resources",
    tags: ["ClickHouse", "database", "interview"],
    mentions: [
      ctoDailyMention(
        1683,
        "2023-05-19T12:02:03.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "phind",
    name: "Phind",
    kind: "TOOL",
    canonicalUrl: "https://www.phind.com/",
    description:
      "Answer and search assistant for programmers that cites the sources behind its responses.",
    category: "AI development",
    tags: ["developer search", "AI assistant", "citations"],
    mentions: [
      ctoDailyMention(
        1707,
        "2023-11-17T07:26:00.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "machinet",
    name: "Machinet",
    kind: "PLUGIN",
    canonicalUrl: "https://www.machinet.net/",
    description:
      "IDE chat assistant that uses project-wide context to generate changes and fix code.",
    category: "AI development",
    tags: ["IDE plugin", "AI assistant", "code generation"],
    mentions: [
      ctoDailyMention(
        1707,
        "2023-11-17T07:26:00.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "how-to-build-an-agent",
    name: "How to Build an Agent",
    kind: "GUIDE",
    canonicalUrl: "https://ampcode.com/how-to-build-an-agent",
    description:
      "Compact technical explanation of an AI agent's tool-calling loop with a complete implementation example.",
    category: "Learning resources",
    tags: ["AI agents", "tool calling", "programming guide"],
    mentions: [
      ctoDailyMention(
        1848,
        "2025-06-04T20:43:40.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "cursor-agent-mode",
    name: "Cursor Agent Mode",
    kind: "FEATURE",
    parentName: "Cursor",
    canonicalUrl: "https://docs.cursor.com/chat/agent",
    description:
      "Cursor feature that autonomously requests files, runs linters, and invokes other development tools.",
    category: "AI development",
    tags: ["Cursor", "AI agents", "tool calling"],
    mentions: [
      ctoDailyMention(
        1848,
        "2025-06-04T20:43:40.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "surveillance-self-defense",
    name: "Surveillance Self-Defense",
    kind: "GUIDE",
    canonicalUrl: "https://ssd.eff.org/en",
    description:
      "EFF's practical, maintained guide to personal digital security, privacy, and threat-aware online behavior.",
    category: "Security",
    tags: ["digital security", "privacy", "EFF"],
    mentions: [
      ctoDailyMention(
        570,
        "2018-03-02T12:29:04.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "codeguide",
    name: "CodeGuide",
    kind: "GUIDE",
    canonicalUrl: "https://www.codeguide.dev/",
    description:
      "Project-documentation workflow for giving AI coding tools clearer requirements and implementation plans.",
    category: "Learning resources",
    tags: ["AI coding", "project specification", "workflow"],
    mentions: [
      notBoringMention(
        3492,
        "2025-03-11T08:01:07.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "cursor-talk-to-figma-mcp",
    name: "Cursor Talk to Figma MCP",
    kind: "PLUGIN",
    canonicalUrl: "https://github.com/sonnylazuardi/cursor-talk-to-figma-mcp",
    description:
      "MCP integration that lets coding agents read, modify, and operate Figma design files.",
    category: "Design",
    tags: ["Figma", "MCP", "AI coding"],
    mentions: [
      notBoringMention(
        3500,
        "2025-03-18T21:55:16.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "mcp-containers",
    name: "MCP Containers",
    kind: "PROJECT",
    canonicalUrl: "https://github.com/metorial/mcp-containers",
    description:
      "Catalog of containerized MCP servers that can be installed without configuring each integration manually.",
    category: "AI development",
    tags: ["MCP", "containers", "integrations"],
    mentions: [
      notBoringMention(
        3620,
        "2025-06-13T22:01:16.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "cursor-visual-editor",
    name: "Cursor Visual Editor",
    kind: "FEATURE",
    parentName: "Cursor",
    canonicalUrl: "https://cursor.com/blog/browser-visual-editor",
    description:
      "Cursor feature for visually selecting and editing web-interface elements while it updates the underlying code.",
    category: "AI development",
    tags: ["Cursor", "visual editor", "UI development"],
    mentions: [
      notBoringMention(
        3988,
        "2025-12-12T23:07:00.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "react-grab",
    name: "React Grab",
    kind: "TOOL",
    canonicalUrl: "https://github.com/aidenybai/react-grab",
    description:
      "Developer tool that captures a selected React element's source context for AI coding agents.",
    category: "Frontend",
    tags: ["React", "AI coding", "UI development"],
    mentions: [
      notBoringMention(
        4001,
        "2025-12-18T22:57:32.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "pencil",
    name: "Pencil",
    kind: "TOOL",
    canonicalUrl: "https://www.pencil.dev/",
    description:
      "Design canvas for coding agents that generates parallel, editable UI designs and exports production assets.",
    category: "Design",
    tags: ["AI design", "UI generation", "coding agents"],
    mentions: [
      notBoringMention(
        4089,
        "2026-02-25T23:15:20.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "perplexica",
    name: "Perplexica",
    kind: "PROJECT",
    canonicalUrl: "https://github.com/ItzCrazyKns/Perplexica",
    description:
      "Open-source answer engine with cited web search, focused modes, and local or hosted model support.",
    category: "AI productivity",
    tags: ["answer engine", "web search", "open source"],
    mentions: [
      notBoringMention(
        4099,
        "2026-03-03T23:53:33.000Z",
        subjectAuditCollectionTime
      ),
    ],
  },
  {
    slug: "github-copilot",
    name: "GitHub Copilot",
    kind: "TOOL",
    canonicalUrl: "https://github.com/features/copilot",
    description:
      "AI pair programmer for code completion, chat, review, and agentic changes.",
    category: "AI development",
    tags: ["code completion", "AI assistant", "GitHub"],
    mentions: [ctoDailyMention(1707, "2023-11-17T07:26:00.000Z")],
  },
  {
    slug: "langgraph",
    name: "LangGraph",
    kind: "LIBRARY",
    canonicalUrl: "https://www.langchain.com/langgraph",
    description:
      "Framework for durable, stateful agent workflows with controllable execution.",
    category: "AI development",
    tags: ["agents", "workflow", "Python"],
    mentions: [ctoDailyMention(1897, "2025-09-09T10:31:53.000Z")],
  },
  {
    slug: "mem-agent",
    name: "mem-agent",
    kind: "PROJECT",
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
    kind: "SERVICE",
    canonicalUrl: "https://dify.ai/",
    description:
      "Open platform for composing, evaluating, and operating generative AI applications.",
    category: "AI development",
    tags: ["low-code", "LLM", "workflow"],
    mentions: [ctoDailyMention(1897, "2025-09-09T10:31:53.000Z")],
  },
  {
    slug: "nano-banana",
    name: "Nano Banana",
    kind: "PRODUCT",
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
    slug: "q",
    name: "q",
    kind: "TOOL",
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
    kind: "TOOL",
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
    slug: "postico",
    name: "Postico 2",
    kind: "TOOL",
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
    slug: "postgres-new",
    name: "Postgres.new",
    kind: "SERVICE",
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
    kind: "OTHER_TECH",
    canonicalUrl: "https://www.postgresql.org/",
    description:
      "Extensible relational database with strong SQL support and a mature ecosystem.",
    category: "Data systems",
    tags: ["database", "SQL", "open source"],
    mentions: [ctoDailyMention(1998, "2026-02-04T22:07:06.000Z")],
  },
  {
    slug: "supabase",
    name: "Supabase",
    kind: "SERVICE",
    canonicalUrl: "https://supabase.com/",
    description:
      "Hosted Postgres platform with authentication, storage, realtime, and edge functions.",
    category: "Data systems",
    tags: ["Postgres", "backend as a service", "serverless"],
    mentions: [ctoDailyMention(1670, "2023-02-06T07:13:02.000Z")],
  },
  {
    slug: "figma",
    name: "Figma",
    kind: "PRODUCT",
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
    kind: "SERVICE",
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
    kind: "TOOL",
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
    kind: "LIBRARY",
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
    kind: "TOOL",
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
    kind: "PRODUCT",
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
    slug: "tuple",
    name: "Tuple",
    kind: "PRODUCT",
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
    kind: "PROJECT",
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
    kind: "PRODUCT",
    canonicalUrl: "https://www.docker.com/",
    description:
      "Container tooling for packaging and running applications consistently.",
    category: "Infrastructure",
    tags: ["containers", "deployment", "developer workflow"],
    mentions: [ctoDailyMention(1303, "2021-04-16T10:43:25.000Z")],
  },
  {
    slug: "pglite",
    name: "PGlite",
    kind: "LIBRARY",
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
    kind: "SERVICE",
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
    slug: "pyspur",
    name: "PySpur",
    kind: "PROJECT",
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
] as const satisfies readonly Tool[]

export const toolsBySlug: ReadonlyMap<string, Tool> = new Map(
  tools.map((tool) => [tool.slug, tool])
)

export const toolsByName: ReadonlyMap<string, Tool> = new Map(
  tools.map((tool) => [tool.name, tool])
)

export const categories = [...new Set(tools.map((tool) => tool.category))].sort(
  (left, right) => left.localeCompare(right)
)

export const tags = [...new Set(tools.flatMap((tool) => tool.tags))].sort(
  (left, right) => left.localeCompare(right)
)
