import type { TechnologyKind } from "@techdex/contracts"

export type ExpectedSubject = {
  readonly slug: string
  readonly kind: TechnologyKind
}

export type SubjectAuditCase = {
  readonly sourceUrl: string
  readonly expectedSubjects: readonly ExpectedSubject[]
  readonly decision:
    | "PRIMARY_SUBJECT"
    | "RELATED_SUBJECT"
    | "INCIDENTAL_OR_CONTEXT"
    | "GENERIC_NEWS_OR_OPINION"
  readonly note: string
}

/**
 * Source-audited acceptance cases for the primary-subject boundary.
 *
 * These cases intentionally record decisions and identifiers, not copied post
 * bodies. An empty expectedSubjects array means the post must not create a
 * searchable presentation record.
 */
export const subjectAuditCases: readonly SubjectAuditCase[] = [
  {
    sourceUrl: "https://t.me/notboring_tech/3700",
    expectedSubjects: [{ slug: "claude-code-templates", kind: "PROJECT" }],
    decision: "RELATED_SUBJECT",
    note: "Presents the templates project, not Claude Code itself.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4008",
    expectedSubjects: [{ slug: "claude-code-project-guide", kind: "GUIDE" }],
    decision: "RELATED_SUBJECT",
    note: "Presents a video guide for a Claude Code project workflow.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1963",
    expectedSubjects: [],
    decision: "GENERIC_NEWS_OR_OPINION",
    note: "Opinion and news with only an incidental Claude Code reference.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1966",
    expectedSubjects: [{ slug: "claude-code", kind: "TOOL" }],
    decision: "PRIMARY_SUBJECT",
    note: "Directly recommends and explains Claude Code.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1972",
    expectedSubjects: [{ slug: "claude-code", kind: "TOOL" }],
    decision: "PRIMARY_SUBJECT",
    note: "A substantive first-person Claude Code review.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1974",
    expectedSubjects: [
      { slug: "opencode", kind: "TOOL" },
      { slug: "oh-my-opencode", kind: "PLUGIN" },
    ],
    decision: "RELATED_SUBJECT",
    note: "Presents OpenCode and its extension; Claude Code is context.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1977",
    expectedSubjects: [{ slug: "cowork", kind: "PRODUCT" }],
    decision: "RELATED_SUBJECT",
    note: "Presents the distinct Cowork product.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/2008",
    expectedSubjects: [{ slug: "claude-code-agent-teams", kind: "FEATURE" }],
    decision: "RELATED_SUBJECT",
    note: "Presents the Agent Teams feature, not its parent tool.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4082",
    expectedSubjects: [{ slug: "antigravity-awesome-skills", kind: "PROJECT" }],
    decision: "RELATED_SUBJECT",
    note: "Presents a reusable skills collection for several coding agents.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4085",
    expectedSubjects: [{ slug: "hugging-face-skills", kind: "PLUGIN" }],
    decision: "RELATED_SUBJECT",
    note: "Presents the Hugging Face skills package.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4097",
    expectedSubjects: [{ slug: "claude-code-best-practice", kind: "GUIDE" }],
    decision: "RELATED_SUBJECT",
    note: "Presents a best-practice reference.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4102",
    expectedSubjects: [{ slug: "claude-code-skill-creator", kind: "PLUGIN" }],
    decision: "RELATED_SUBJECT",
    note: "Presents Anthropic's Skill Creator plugin.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/2028",
    expectedSubjects: [{ slug: "nanochat", kind: "PROJECT" }],
    decision: "RELATED_SUBJECT",
    note: "Presents Karpathy's nanochat learning project.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4107",
    expectedSubjects: [{ slug: "gstack", kind: "PROJECT" }],
    decision: "RELATED_SUBJECT",
    note: "Presents gstack, an opinionated skills setup package.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/2032",
    expectedSubjects: [
      { slug: "claude-code-technical-audit-guide", kind: "GUIDE" },
    ],
    decision: "RELATED_SUBJECT",
    note: "Presents a reusable technical-audit workflow and reference.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4111",
    expectedSubjects: [{ slug: "claude-code-channels", kind: "FEATURE" }],
    decision: "RELATED_SUBJECT",
    note: "Presents the Channels feature of Claude Code.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4114",
    expectedSubjects: [
      { slug: "claude-code-cheat-sheet", kind: "CHEAT_SHEET" },
    ],
    decision: "RELATED_SUBJECT",
    note: "Presents a standalone Claude Code cheat sheet.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/2054",
    expectedSubjects: [],
    decision: "GENERIC_NEWS_OR_OPINION",
    note: "Product-quality news, not a presentation of a usable subject.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1253",
    expectedSubjects: [
      { slug: "figma", kind: "PRODUCT" },
      { slug: "tuple", kind: "PRODUCT" },
    ],
    decision: "PRIMARY_SUBJECT",
    note: "Materially explains both collaborative Figma editing and Tuple.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1770",
    expectedSubjects: [{ slug: "postgres-new", kind: "SERVICE" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents Postgres.new; Supabase is its maker, not a second subject.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1783",
    expectedSubjects: [{ slug: "claude-computer-use", kind: "FEATURE" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents Claude Computer Use; Docker and Open Interpreter are trial paths.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1897",
    expectedSubjects: [
      { slug: "langgraph", kind: "LIBRARY" },
      { slug: "dify", kind: "SERVICE" },
      { slug: "pyspur", kind: "PROJECT" },
    ],
    decision: "PRIMARY_SUBJECT",
    note: "Provides substantive hands-on evaluations of all three subjects.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/2022",
    expectedSubjects: [{ slug: "vinext", kind: "LIBRARY" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents vinext; Vite and Next.js describe its implementation context.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/525",
    expectedSubjects: [
      { slug: "postico", kind: "TOOL" },
      { slug: "datagrip", kind: "TOOL" },
      { slug: "navicat", kind: "TOOL" },
      { slug: "sequel-pro", kind: "TOOL" },
    ],
    decision: "PRIMARY_SUBJECT",
    note: "Explicitly presents four alternative desktop database clients.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/3456",
    expectedSubjects: [{ slug: "google-agents-whitepaper", kind: "GUIDE" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents Google's agents whitepaper; named frameworks are its contents.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/3780",
    expectedSubjects: [{ slug: "500-ai-agents-projects", kind: "PROJECT" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents the project catalog; framework names are example implementations.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/3797",
    expectedSubjects: [{ slug: "mem-agent", kind: "PROJECT" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents mem-agent; integrations and comparisons are incidental.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/3832",
    expectedSubjects: [
      { slug: "build-your-first-ai-agent-guide", kind: "GUIDE" },
    ],
    decision: "PRIMARY_SUBJECT",
    note: "Presents an AI-agent guide; Playwright and Puppeteer are examples.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4176",
    expectedSubjects: [{ slug: "sloplobster", kind: "PROJECT" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents SlopLobster; LM Studio and Playwright are supporting integrations.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1118",
    expectedSubjects: [],
    decision: "INCIDENTAL_OR_CONTEXT",
    note: "A technical postmortem that only names monitoring dependencies.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1119",
    expectedSubjects: [{ slug: "datadog", kind: "SERVICE" }],
    decision: "PRIMARY_SUBJECT",
    note: "Substantively explains and recommends Datadog's monitoring workflow.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1303",
    expectedSubjects: [{ slug: "docker", kind: "PRODUCT" }],
    decision: "PRIMARY_SUBJECT",
    note: "Explains Docker and its newly released Apple Silicon support.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1530",
    expectedSubjects: [],
    decision: "GENERIC_NEWS_OR_OPINION",
    note: "Political company news, not a technology presentation.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1670",
    expectedSubjects: [{ slug: "supabase", kind: "SERVICE" }],
    decision: "PRIMARY_SUBJECT",
    note: "Directly introduces Supabase and explains its backend capabilities.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1683",
    expectedSubjects: [{ slug: "clickhouse-podcast", kind: "PODCAST" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents a specific interview episode about ClickHouse's creation.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1690",
    expectedSubjects: [],
    decision: "GENERIC_NEWS_OR_OPINION",
    note: "A podcast-season recap with only a passing ClickHouse mention.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1707",
    expectedSubjects: [
      { slug: "github-copilot", kind: "TOOL" },
      { slug: "phind", kind: "TOOL" },
      { slug: "machinet", kind: "PLUGIN" },
    ],
    decision: "PRIMARY_SUBJECT",
    note: "Provides a direct recommendation and concrete description of all three developer assistants.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1745",
    expectedSubjects: [],
    decision: "GENERIC_NEWS_OR_OPINION",
    note: "Access-blocking news about Docker Hub, not a Docker presentation.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1769",
    expectedSubjects: [{ slug: "pglite", kind: "LIBRARY" }],
    decision: "PRIMARY_SUBJECT",
    note: "Directly introduces PGlite and explains its runtime and size.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1784",
    expectedSubjects: [{ slug: "cursor", kind: "TOOL" }],
    decision: "PRIMARY_SUBJECT",
    note: "Substantive first-person evaluation of Cursor.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1848",
    expectedSubjects: [
      { slug: "how-to-build-an-agent", kind: "GUIDE" },
      { slug: "cursor-agent-mode", kind: "FEATURE" },
    ],
    decision: "PRIMARY_SUBJECT",
    note: "Presents both the implementation guide and Cursor's concrete agent feature.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1883",
    expectedSubjects: [{ slug: "lovable", kind: "SERVICE" }],
    decision: "PRIMARY_SUBJECT",
    note: "A detailed first-person Lovable use case and evaluation.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/1998",
    expectedSubjects: [{ slug: "postgresql", kind: "OTHER_TECH" }],
    decision: "PRIMARY_SUBJECT",
    note: "Materially explains PostgreSQL's capabilities, governance, and engineering value.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/2085",
    expectedSubjects: [],
    decision: "GENERIC_NEWS_OR_OPINION",
    note: "Inference-cost opinion where GitHub Copilot is only a pricing example.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/434",
    expectedSubjects: [{ slug: "q", kind: "TOOL" }],
    decision: "PRIMARY_SUBJECT",
    note: "Direct recommendation and explanation of q's CSV query workflow.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/5",
    expectedSubjects: [],
    decision: "INCIDENTAL_OR_CONTEXT",
    note: "A debugging anecdote that only names ngrok in the setup.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/524",
    expectedSubjects: [{ slug: "tableplus", kind: "TOOL" }],
    decision: "PRIMARY_SUBJECT",
    note: "Directly recommends and describes TablePlus.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/570",
    expectedSubjects: [{ slug: "surveillance-self-defense", kind: "GUIDE" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents EFF's maintained security guide; 1Password is an incidental preference.",
  },
  {
    sourceUrl: "https://t.me/ctodaily/62",
    expectedSubjects: [],
    decision: "INCIDENTAL_OR_CONTEXT",
    note: "An outage anecdote that only names Bugsnag as an affected dependency.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/2338",
    expectedSubjects: [{ slug: "artbreeder-collage", kind: "PRODUCT" }],
    decision: "PRIMARY_SUBJECT",
    note: "Directly introduces and explains Artbreeder Collage.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/2520",
    expectedSubjects: [],
    decision: "INCIDENTAL_OR_CONTEXT",
    note: "Presents a short film; Stable Diffusion is one tool used to make it.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/3492",
    expectedSubjects: [{ slug: "codeguide", kind: "GUIDE" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents the linked CodeGuide workflow, not Cursor itself.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/3500",
    expectedSubjects: [{ slug: "cursor-talk-to-figma-mcp", kind: "PLUGIN" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents a Figma MCP integration rather than its supported host tools.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/3620",
    expectedSubjects: [{ slug: "mcp-containers", kind: "PROJECT" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents the MCP Containers catalog; Docker is the packaging mechanism.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/3758",
    expectedSubjects: [{ slug: "nano-banana", kind: "PRODUCT" }],
    decision: "PRIMARY_SUBJECT",
    note: "Materially showcases Nano Banana through concrete image workflows.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/3988",
    expectedSubjects: [{ slug: "cursor-visual-editor", kind: "FEATURE" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents Cursor's Visual Editor feature, not the parent editor.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4001",
    expectedSubjects: [{ slug: "react-grab", kind: "TOOL" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents React Grab; the supported coding agents are context.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4089",
    expectedSubjects: [{ slug: "pencil", kind: "TOOL" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents Pencil and its Swarm update; IDE names are supported hosts.",
  },
  {
    sourceUrl: "https://t.me/notboring_tech/4099",
    expectedSubjects: [{ slug: "perplexica", kind: "PROJECT" }],
    decision: "PRIMARY_SUBJECT",
    note: "Presents Perplexica; Ollama is one supported model provider.",
  },
]
