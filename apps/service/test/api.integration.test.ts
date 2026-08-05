import type { CatalogListResponse } from "@findthatproject/contracts";
import {
  AnalyzedPostStatus,
  createDbClient,
  type DbClient,
  type PresentationKind,
} from "@findthatproject/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { projectCandidateIds } from "../src/catalog/projector";
import { createServerApp } from "../src/server";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const assertDisposableDatabase = (databaseUrl: string): void => {
  const url = new URL(databaseUrl);
  if (
    !["127.0.0.1", "localhost", "::1"].includes(url.hostname) ||
    url.pathname !== "/findthatproject_test"
  ) {
    throw new Error(
      "TEST_DATABASE_URL must target local database findthatproject_test",
    );
  }
};

interface SeedCandidate {
  readonly handle: string;
  readonly title: string;
  readonly messageId: bigint;
  readonly kind: PresentationKind;
  readonly category: string;
  readonly name: string;
  readonly subjectUrl: string;
  readonly tags: readonly string[];
  readonly publishedAt: Date;
}

const seedCandidate = async (
  database: DbClient,
  input: SeedCandidate,
): Promise<string> => {
  const channel = await database.channel.upsert({
    where: { handle: input.handle },
    create: {
      handle: input.handle,
      title: input.title,
      publicUrl: `https://t.me/${input.handle.slice(1)}`,
    },
    update: { title: input.title, enabled: true },
  });
  const post = await database.analyzedPost.create({
    data: {
      channelId: channel.id,
      telegramMessageId: input.messageId,
      sourceUrl: `https://t.me/${input.handle.slice(1)}/${input.messageId}`,
      publishedAt: input.publishedAt,
      contentHash: input.messageId.toString().padStart(64, "0"),
      status: AnalyzedPostStatus.PRESENTATIONS_SAVED,
      promptVersion: "api-test-prompt",
      schemaVersion: "api-test-schema",
      analysisVersion: "api-test-analysis",
      modelId: "api-test-model",
    },
  });
  const candidate = await database.presentationCandidate.create({
    data: {
      analyzedPostId: post.id,
      ordinal: 0,
      kind: input.kind,
      category: input.category,
      name: input.name,
      parentName: null,
      subjectUrl: input.subjectUrl,
      descriptionEn: `${input.name} is a synthetic API integration subject.`,
      tags: [...input.tags],
      sourceLanguage: "en",
      confidence: 0.9,
    },
  });
  return candidate.id;
};

const seedCatalog = async (database: DbClient): Promise<void> => {
  const candidates = [
    await seedCandidate(database, {
      handle: "@channel_one",
      title: "Channel One",
      messageId: 1n,
      kind: "PROJECT",
      category: "Developer tools",
      name: "Alpha Project",
      subjectUrl: "https://example.com/alpha",
      tags: ["alpha", "common"],
      publishedAt: new Date("2026-08-01T10:00:00.000Z"),
    }),
    await seedCandidate(database, {
      handle: "@channel_two",
      title: "Channel Two",
      messageId: 2n,
      kind: "PROJECT",
      category: "Developer tools",
      name: "Alpha Project",
      subjectUrl: "https://example.com/alpha?utm_source=telegram",
      tags: ["common", "second-source"],
      publishedAt: new Date("2026-08-02T10:00:00.000Z"),
    }),
    await seedCandidate(database, {
      handle: "@channel_two",
      title: "Channel Two",
      messageId: 3n,
      kind: "TOOL",
      category: "Security",
      name: "Beta Tool",
      subjectUrl: "https://example.com/beta",
      tags: ["beta", "common"],
      publishedAt: new Date("2026-08-03T10:00:00.000Z"),
    }),
  ];
  await database.$transaction((transaction) =>
    projectCandidateIds(transaction, candidates),
  );
};

describe.skipIf(!testDatabaseUrl)("catalog API integration", () => {
  let database: DbClient;

  beforeAll(() => {
    assertDisposableDatabase(testDatabaseUrl!);
    database = createDbClient(testDatabaseUrl!);
  });

  beforeEach(async () => {
    await database.presentationCandidate.deleteMany();
    await database.catalogItem.deleteMany();
    await database.analyzedPost.deleteMany();
    await database.channel.deleteMany();
    await database.ingestionRun.deleteMany();
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("distinguishes an empty database from a populated filtered catalog", async () => {
    const app = createServerApp(database);
    const empty = await app.request("/v1/catalog");
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({ items: [], nextCursor: null });

    await seedCatalog(database);
    const response = await app.request(
      "/v1/catalog?q=alpha&kind=PROJECT&category=Developer%20tools&channel=%40channel_one&tag=common&sort=name",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [
        {
          slug: "alpha-project",
          mentionCount: 2,
          channelCount: 2,
        },
      ],
      filters: {
        q: "alpha",
        kind: ["PROJECT"],
        category: ["Developer tools"],
        channel: ["@channel_one"],
        tag: ["common"],
        sort: "name",
      },
    });

    const tagSearch = await app.request("/v1/catalog?q=second-source");
    expect(await tagSearch.json()).toMatchObject({
      items: [{ slug: "alpha-project" }],
    });
  });

  it("paginates stably and rejects malformed or mismatched cursors", async () => {
    await seedCatalog(database);
    const app = createServerApp(database);
    const first = await app.request("/v1/catalog?sort=name&limit=1");
    const firstBody = (await first.json()) as CatalogListResponse;
    expect(firstBody.items.map((item) => item.slug)).toEqual(["alpha-project"]);
    expect(firstBody.nextCursor).toEqual(expect.any(String));

    const second = await app.request(
      `/v1/catalog?sort=name&limit=1&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
    );
    const secondBody = (await second.json()) as CatalogListResponse;
    expect(secondBody.items.map((item) => item.slug)).toEqual(["beta-tool"]);
    expect(secondBody.nextCursor).toBeNull();

    const malformed = await app.request("/v1/catalog?cursor=not-base64");
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({
      error: { code: "BAD_REQUEST", requestId: expect.any(String) },
    });
    const changedSort = await app.request(
      `/v1/catalog?sort=latest&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
    );
    expect(changedSort.status).toBe(400);
    expect((await app.request("/v1/catalog?unknown=value")).status).toBe(400);
  });

  it("orders recent entries by first presentation, not a later repeat mention", async () => {
    await seedCatalog(database);
    const repeatedAlpha = await seedCandidate(database, {
      handle: "@channel_three",
      title: "Channel Three",
      messageId: 4n,
      kind: "PROJECT",
      category: "Developer tools",
      name: "Alpha Project",
      subjectUrl: "https://example.com/alpha",
      tags: ["alpha", "repeat-mention"],
      publishedAt: new Date("2026-08-04T10:00:00.000Z"),
    });
    await database.$transaction((transaction) =>
      projectCandidateIds(transaction, [repeatedAlpha]),
    );
    const app = createServerApp(database);

    const first = await app.request("/v1/catalog?sort=latest&limit=1");
    const firstBody = (await first.json()) as CatalogListResponse;
    expect(firstBody.items.map((item) => item.slug)).toEqual(["beta-tool"]);
    expect(firstBody.nextCursor).toEqual(expect.any(String));

    const second = await app.request(
      `/v1/catalog?sort=latest&limit=1&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
    );
    const secondBody = (await second.json()) as CatalogListResponse;
    expect(secondBody.items.map((item) => item.slug)).toEqual([
      "alpha-project",
    ]);
    expect(secondBody.nextCursor).toBeNull();
  });

  it("sorts known GitHub star counts first and paginates into unknown counts", async () => {
    await seedCatalog(database);
    const unknownStarsCandidate = await seedCandidate(database, {
      handle: "@channel_three",
      title: "Channel Three",
      messageId: 4n,
      kind: "LIBRARY",
      category: "Infrastructure",
      name: "Gamma Library",
      subjectUrl: "https://example.com/gamma",
      tags: ["gamma"],
      publishedAt: new Date("2026-08-04T10:00:00.000Z"),
    });
    await database.$transaction((transaction) =>
      projectCandidateIds(transaction, [unknownStarsCandidate]),
    );
    await database.catalogItem.updateMany({
      where: { slug: { in: ["alpha-project", "beta-tool"] } },
      data: { githubStars: 1_000 },
    });
    await database.catalogItem.update({
      where: { slug: "beta-tool" },
      data: { githubStars: 2_000 },
    });
    const app = createServerApp(database);

    const first = await app.request("/v1/catalog?sort=stars&limit=2");
    const firstBody = (await first.json()) as CatalogListResponse;
    expect(firstBody.items.map((item) => item.slug)).toEqual([
      "beta-tool",
      "alpha-project",
    ]);
    expect(firstBody.filters.sort).toBe("stars");
    expect(firstBody.nextCursor).toEqual(expect.any(String));

    const second = await app.request(
      `/v1/catalog?sort=stars&limit=2&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
    );
    const secondBody = (await second.json()) as CatalogListResponse;
    expect(secondBody.items.map((item) => item.slug)).toEqual([
      "gamma-library",
    ]);
    expect(secondBody.nextCursor).toBeNull();
  });

  it("serves detail provenance plus live facets and channels without internals", async () => {
    await seedCatalog(database);
    const app = createServerApp(database);

    const detail = await app.request("/v1/catalog/alpha-project");
    expect(detail.status).toBe(200);
    const detailText = await detail.text();
    expect(JSON.parse(detailText)).toMatchObject({
      item: {
        slug: "alpha-project",
        mentionCount: 2,
        channelCount: 2,
        mentions: [
          {
            channelHandle: "@channel_two",
            channelTitle: "Channel Two",
            sourceUrl: "https://t.me/channel_two/2",
          },
          {
            channelHandle: "@channel_one",
            channelTitle: "Channel One",
            sourceUrl: "https://t.me/channel_one/1",
          },
        ],
      },
    });
    expect(detailText).not.toMatch(
      /identityKey|catalogItemId|analyzedPostId|contentHash|promptVersion/u,
    );

    expect(await (await app.request("/v1/facets")).json()).toMatchObject({
      categories: [
        { value: "Developer tools", count: 1 },
        { value: "Security", count: 1 },
      ],
      kinds: [
        { value: "PROJECT", count: 1 },
        { value: "TOOL", count: 1 },
      ],
      channels: [
        { value: "@channel_one", label: "Channel One", count: 1 },
        { value: "@channel_two", label: "Channel Two", count: 2 },
      ],
    });
    expect(await (await app.request("/v1/channels")).json()).toMatchObject({
      channels: [
        { handle: "@channel_one", itemCount: 1, mentionCount: 1 },
        { handle: "@channel_two", itemCount: 2, mentionCount: 2 },
      ],
    });
  });

  it("hides disabled-only items consistently across all endpoints", async () => {
    await seedCatalog(database);
    await database.channel.updateMany({ data: { enabled: false } });
    const app = createServerApp(database);

    expect(await (await app.request("/v1/catalog")).json()).toMatchObject({
      items: [],
    });
    expect((await app.request("/v1/catalog/alpha-project")).status).toBe(404);
    expect(await (await app.request("/v1/facets")).json()).toEqual({
      categories: [],
      kinds: [],
      channels: [],
    });
    expect(await (await app.request("/v1/channels")).json()).toEqual({
      channels: [],
    });
  });
});
