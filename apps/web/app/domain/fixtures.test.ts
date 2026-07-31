import type { Channel } from "@techdex/contracts"
import { describe, expect, it } from "vitest"

import { channels, isOwnerApprovedCorpus } from "../data/channels"
import { subjectAuditCases } from "../data/subject-audit"
import { categories, tags, tools } from "../data/tools"
import { distinctChannelCount, firstPresentation } from "./tools"

function expectUnique(values: readonly string[]): void {
  expect(new Set(values).size).toBe(values.length)
}

describe("fixture invariants", () => {
  it("records owner approval of the audited corpus", () => {
    expect(isOwnerApprovedCorpus).toBe(true)
  })

  it("provides enough records to exercise the planned interface", () => {
    expect(tools.length).toBeGreaterThanOrEqual(40)
    expect(categories.length).toBeGreaterThanOrEqual(5)
    expect(tags.length).toBeGreaterThanOrEqual(20)
  })

  it("keeps identifiers and URLs unique where required", () => {
    expectUnique(channels.map((channel) => channel.id))
    expectUnique(channels.map((channel) => channel.publicUrl))
    expectUnique(tools.map((tool) => tool.slug))
    expectUnique(tools.map((tool) => tool.canonicalUrl))

    for (const tool of tools) {
      expectUnique(tool.mentions.map((mention) => mention.sourceUrl))
    }
  })

  it("uses known channels, parseable UTC dates, and at least one mention", () => {
    const channelsById = new Map<string, Channel>(
      channels.map((channel) => [channel.id, channel])
    )

    for (const tool of tools) {
      expect(tool.mentions.length, tool.slug).toBeGreaterThan(0)
      expect(() => new URL(tool.canonicalUrl), tool.slug).not.toThrow()

      for (const mention of tool.mentions) {
        const channel = channelsById.get(mention.channelId)

        expect(channel, tool.slug).toBeDefined()
        expect(() => new URL(mention.sourceUrl), tool.slug).not.toThrow()
        expect(
          mention.sourceUrl.startsWith(`${channel!.publicUrl}/`),
          tool.slug
        ).toBe(true)
        expect(mention.publishedAt.endsWith("Z"), tool.slug).toBe(true)
        expect(mention.collectedAt.endsWith("Z"), tool.slug).toBe(true)
        expect(Number.isNaN(Date.parse(mention.publishedAt)), tool.slug).toBe(
          false
        )
        expect(Number.isNaN(Date.parse(mention.collectedAt)), tool.slug).toBe(
          false
        )
        expect(
          Date.parse(mention.collectedAt),
          `${tool.slug} collection date`
        ).toBeGreaterThanOrEqual(Date.parse(mention.publishedAt))
      }
    }
  })

  it("models subject kinds and feature parents explicitly", () => {
    for (const tool of tools) {
      if (tool.kind === "FEATURE") {
        expect(tool.parentName?.trim(), tool.slug).toBeTruthy()
        expect(tool.parentName, tool.slug).not.toBe(tool.name)
      } else {
        expect(tool.parentName, tool.slug).toBeUndefined()
      }
    }
  })

  it("preserves the source-audited primary-subject decisions", () => {
    const assignedSlugsBySource = new Map<string, string[]>()
    const toolsBySlug = new Map(tools.map((tool) => [tool.slug, tool]))
    const auditedSourceUrls = new Set(
      subjectAuditCases.map((auditCase) => auditCase.sourceUrl)
    )

    expectUnique(subjectAuditCases.map((auditCase) => auditCase.sourceUrl))

    for (const tool of tools) {
      for (const mention of tool.mentions) {
        const assignedSlugs = assignedSlugsBySource.get(mention.sourceUrl) ?? []

        assignedSlugs.push(tool.slug)
        assignedSlugsBySource.set(mention.sourceUrl, assignedSlugs)
      }
    }

    for (const sourceUrl of assignedSlugsBySource.keys()) {
      expect(auditedSourceUrls.has(sourceUrl), sourceUrl).toBe(true)
    }

    for (const auditCase of subjectAuditCases) {
      const expectedSlugs = auditCase.expectedSubjects
        .map((subject) => subject.slug)
        .sort()
      const actualSlugs = [
        ...(assignedSlugsBySource.get(auditCase.sourceUrl) ?? []),
      ].sort()

      expect(actualSlugs, auditCase.sourceUrl).toEqual(expectedSlugs)

      for (const expectedSubject of auditCase.expectedSubjects) {
        expect(
          toolsBySlug.get(expectedSubject.slug)?.kind,
          `${auditCase.sourceUrl} -> ${expectedSubject.slug}`
        ).toBe(expectedSubject.kind)
      }

      if (
        auditCase.decision === "GENERIC_NEWS_OR_OPINION" ||
        auditCase.decision === "INCIDENTAL_OR_CONTEXT"
      ) {
        expect(auditCase.expectedSubjects, auditCase.sourceUrl).toHaveLength(0)
      } else {
        expect(
          auditCase.expectedSubjects.length,
          auditCase.sourceUrl
        ).toBeGreaterThan(0)
      }
    }
  })

  it("derives presentation dates and channel counts instead of storing them", () => {
    const cursor = tools.find((tool) => tool.slug === "cursor")

    expect(cursor).toBeDefined()
    expect(firstPresentation(cursor!).publishedAt).toBe(
      "2024-10-30T14:49:48.000Z"
    )
    expect(distinctChannelCount(cursor!)).toBe(1)
    expect("firstPresentedAt" in cursor!).toBe(false)
    expect("channelCount" in cursor!).toBe(false)
  })

  it("keeps owner-approved provenance explicit", () => {
    const verifiedSlugs = [
      "cursor",
      "claude-code",
      "claude-code-templates",
      "claude-code-project-guide",
      "opencode",
      "oh-my-opencode",
      "cowork",
      "claude-code-agent-teams",
      "antigravity-awesome-skills",
      "hugging-face-skills",
      "claude-code-best-practice",
      "claude-code-skill-creator",
      "nanochat",
      "gstack",
      "claude-code-technical-audit-guide",
      "claude-code-channels",
      "claude-code-cheat-sheet",
      "claude-computer-use",
      "google-agents-whitepaper",
      "500-ai-agents-projects",
      "build-your-first-ai-agent-guide",
      "sequel-pro",
      "clickhouse-podcast",
      "phind",
      "machinet",
      "how-to-build-an-agent",
      "cursor-agent-mode",
      "surveillance-self-defense",
      "codeguide",
      "cursor-talk-to-figma-mcp",
      "mcp-containers",
      "cursor-visual-editor",
      "react-grab",
      "pencil",
      "perplexica",
      "github-copilot",
      "langgraph",
      "mem-agent",
      "dify",
      "nano-banana",
      "q",
      "tableplus",
      "postico",
      "postgres-new",
      "postgresql",
      "supabase",
      "figma",
      "lovable",
      "datagrip",
      "vinext",
      "navicat",
      "artbreeder-collage",
      "tuple",
      "sloplobster",
      "docker",
      "pglite",
      "datadog",
      "pyspur",
    ]
    const approvedChannels = new Map([
      ["notboring-tech", "https://t.me/notboring_tech/"],
      ["ctodaily", "https://t.me/ctodaily/"],
      ["ai-newz", "https://t.me/ai_newz/"],
      ["denissexy", "https://t.me/denissexy/"],
    ])

    expect(channels).toContainEqual({
      id: "notboring-tech",
      name: "Not Boring Tech",
      publicUrl: "https://t.me/notboring_tech",
    })
    expect(channels).toContainEqual({
      id: "ctodaily",
      name: "запуск завтра",
      publicUrl: "https://t.me/ctodaily",
    })
    expect(channels).toContainEqual({
      id: "ai-newz",
      name: "эйай ньюз",
      publicUrl: "https://t.me/ai_newz",
    })
    expect(channels).toContainEqual({
      id: "denissexy",
      name: "Denis Sexy IT 🤖",
      publicUrl: "https://t.me/denissexy",
    })
    expect(channels).toHaveLength(4)
    expect(verifiedSlugs).toHaveLength(58)

    for (const slug of verifiedSlugs) {
      const tool = tools.find((candidate) => candidate.slug === slug)
      const approvedMentions = tool?.mentions.filter((mention) =>
        approvedChannels.has(mention.channelId)
      )

      expect(tool, slug).toBeDefined()
      expect(approvedMentions?.length, slug).toBeGreaterThan(0)
      expect(approvedMentions, slug).toHaveLength(tool!.mentions.length)

      for (const mention of approvedMentions ?? []) {
        expect(
          mention.sourceUrl.startsWith(
            approvedChannels.get(mention.channelId)!
          ),
          slug
        ).toBe(true)
      }
    }

    expect(
      tools.filter((tool) =>
        tool.mentions.every((mention) =>
          approvedChannels.has(mention.channelId)
        )
      )
    ).toHaveLength(verifiedSlugs.length)
  })
})
