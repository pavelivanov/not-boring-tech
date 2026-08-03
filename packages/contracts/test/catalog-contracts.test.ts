import { describe, expect, it } from "vitest";

import {
  CATALOG_CATEGORIES,
  CATALOG_SORTS,
  TECHNOLOGY_KINDS,
  apiErrorResponseSchema,
  catalogActiveFiltersSchema,
  catalogChannelsResponseSchema,
  catalogDetailResponseSchema,
  catalogFacetsResponseSchema,
  catalogListResponseSchema,
} from "../src/index";

const item = {
  slug: "synthetic-project",
  name: "Synthetic Project",
  kind: "PROJECT" as const,
  category: "Developer tools" as const,
  parentName: null,
  canonicalUrl: "https://example.com/synthetic-project",
  githubStars: 12_345,
  githubStarsUpdatedAt: "2026-08-02T10:00:00.000Z",
  descriptionEn: "A compact synthetic catalog record for contract tests.",
  tags: ["synthetic", "testing"],
  firstMentionedAt: "2026-08-01T09:00:00.000Z",
  lastMentionedAt: "2026-08-02T09:00:00.000Z",
  mentionCount: 2,
  channelCount: 1,
};

const filters = {
  q: "synthetic",
  kind: ["PROJECT" as const],
  category: ["Developer tools" as const],
  channel: ["@synthetic_channel"],
  tag: ["testing"],
  sort: "latest" as const,
  limit: 24,
};

describe("catalog transport contracts", () => {
  it("accepts bounded list and detail DTOs with nullable URL fields", () => {
    expect(
      catalogListResponseSchema.parse({
        items: [
          item,
          {
            ...item,
            slug: "url-less",
            canonicalUrl: null,
            githubStars: null,
            githubStarsUpdatedAt: null,
          },
        ],
        nextCursor: "opaque-cursor",
        filters,
      }),
    ).toBeDefined();

    expect(
      catalogDetailResponseSchema.parse({
        item: {
          ...item,
          mentions: [
            {
              channelHandle: "@synthetic_channel",
              channelTitle: "Synthetic channel",
              channelPublicUrl: "https://t.me/synthetic_channel",
              sourceUrl: "https://t.me/synthetic_channel/42",
              publishedAt: "2026-08-01T09:00:00.000Z",
              confidence: 0.925,
            },
          ],
        },
      }).item.mentions,
    ).toHaveLength(1);
  });

  it("accepts live facet, channel, and safe error DTOs", () => {
    expect(
      catalogFacetsResponseSchema.parse({
        categories: [{ value: "Developer tools", count: 1 }],
        kinds: [{ value: "PROJECT", count: 1 }],
        channels: [
          { value: "@synthetic_channel", label: "Synthetic channel", count: 1 },
        ],
        tags: [{ value: "testing", count: 1 }],
      }),
    ).toBeDefined();
    expect(
      catalogChannelsResponseSchema.parse({
        channels: [
          {
            handle: "@synthetic_channel",
            title: null,
            publicUrl: "https://t.me/synthetic_channel",
            itemCount: 1,
            mentionCount: 2,
            latestMentionedAt: "2026-08-02T09:00:00.000Z",
          },
        ],
      }),
    ).toBeDefined();
    expect(
      apiErrorResponseSchema.parse({
        error: {
          code: "BAD_REQUEST",
          message: "The request query is invalid.",
          requestId: "request-safe-identifier",
        },
      }),
    ).toBeDefined();
  });

  it("rejects invalid enums, dates, URLs, cursors, and unknown fields", () => {
    expect(() =>
      catalogListResponseSchema.parse({
        items: [{ ...item, category: "Model-authored category" }],
        nextCursor: null,
        filters,
      }),
    ).toThrow();
    expect(() =>
      catalogDetailResponseSchema.parse({
        item: {
          ...item,
          mentions: [
            {
              channelHandle: "private channel",
              channelTitle: null,
              channelPublicUrl: "file:///private/channel",
              sourceUrl: "https://t.me/synthetic_channel/42",
              publishedAt: "yesterday",
              confidence: 2,
            },
          ],
        },
      }),
    ).toThrow();
    expect(() =>
      catalogListResponseSchema.parse({
        items: [item],
        nextCursor: "x".repeat(2_049),
        filters,
        internalDatabaseId: "must-not-cross-the-boundary",
      }),
    ).toThrow();
  });

  it("constrains normalized active filters and controlled taxonomies", () => {
    expect(catalogActiveFiltersSchema.parse(filters)).toEqual(filters);
    expect(TECHNOLOGY_KINDS).toContain("OTHER_TECH");
    expect(CATALOG_CATEGORIES).toContain("Other");
    expect(CATALOG_SORTS).toContain("stars");
    expect(() =>
      catalogActiveFiltersSchema.parse({ ...filters, limit: 101 }),
    ).toThrow();
    expect(() =>
      catalogActiveFiltersSchema.parse({
        ...filters,
        tag: Array.from({ length: 21 }, (_, index) => `tag-${index}`),
      }),
    ).toThrow();
  });
});
