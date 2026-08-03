import { AnalyzedPostStatus, createDbClient, type DbClient } from "@techdex/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  backfillCatalogProjection,
  projectCandidateIds,
} from "../src/catalog/projector";
import { reconcileChannels } from "../src/collector/reconcile-channels";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const assertDisposableDatabase = (databaseUrl: string): void => {
  const url = new URL(databaseUrl);
  if (
    !["127.0.0.1", "localhost", "::1"].includes(url.hostname) ||
    url.pathname !== "/techdex_test"
  ) {
    throw new Error(
      "TEST_DATABASE_URL must target local database techdex_test",
    );
  }
};

interface CandidateInput {
  readonly handle: string;
  readonly messageId: bigint;
  readonly name: string;
  readonly subjectUrl: string | null;
  readonly confidence?: number;
  readonly publishedAt?: Date;
  readonly tags?: readonly string[];
}

const createCandidate = async (
  database: DbClient,
  input: CandidateInput,
): Promise<string> => {
  const channel = await database.channel.upsert({
    where: { handle: input.handle },
    create: {
      handle: input.handle,
      title: input.handle.slice(1),
      publicUrl: `https://t.me/${input.handle.slice(1)}`,
    },
    update: { enabled: true },
  });
  const post = await database.analyzedPost.create({
    data: {
      channelId: channel.id,
      telegramMessageId: input.messageId,
      sourceUrl: `https://t.me/${input.handle.slice(1)}/${input.messageId}`,
      publishedAt: input.publishedAt ?? new Date("2026-08-01T10:00:00.000Z"),
      contentHash: input.messageId.toString().padStart(64, "0"),
      status: AnalyzedPostStatus.PRESENTATIONS_SAVED,
      promptVersion: "test-prompt",
      schemaVersion: "test-schema",
      analysisVersion: "test-analysis",
      modelId: "test-model",
    },
  });
  const candidate = await database.presentationCandidate.create({
    data: {
      analyzedPostId: post.id,
      ordinal: 0,
      kind: "PROJECT",
      category: "Developer tools",
      name: input.name,
      parentName: null,
      subjectUrl: input.subjectUrl,
      descriptionEn: `${input.name} synthetic description.`,
      tags: [...(input.tags ?? ["Synthetic"])],
      sourceLanguage: "en",
      confidence: input.confidence ?? 0.9,
    },
  });
  return candidate.id;
};

const project = (database: DbClient, candidateIds: readonly string[]) =>
  database.$transaction((transaction) =>
    projectCandidateIds(transaction, candidateIds),
  );

describe.skipIf(!testDatabaseUrl)("catalog projection integration", () => {
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

  it("merges URL variants and deterministically selects display fields", async () => {
    const first = await createCandidate(database, {
      handle: "@channel_one",
      messageId: 1n,
      name: "Demo Project",
      subjectUrl:
        "https://EXAMPLE.com:443/demo/?utm_source=telegram&b=2&a=1#intro",
      confidence: 0.8,
      publishedAt: new Date("2026-08-01T10:00:00.000Z"),
      tags: ["Alpha"],
    });
    const second = await createCandidate(database, {
      handle: "@channel_two",
      messageId: 2n,
      name: "Demo Project Renamed",
      subjectUrl: "https://example.com/demo?a=1&b=2",
      confidence: 0.95,
      publishedAt: new Date("2026-08-02T10:00:00.000Z"),
      tags: ["Beta", "alpha"],
    });

    await project(database, [first, second]);

    const items = await database.catalogItem.findMany();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      slug: "demo-project-renamed",
      name: "Demo Project Renamed",
      canonicalUrl: "https://example.com/demo?a=1&b=2",
      tags: ["alpha", "beta"],
      firstMentionedAt: new Date("2026-08-01T10:00:00.000Z"),
      lastMentionedAt: new Date("2026-08-02T10:00:00.000Z"),
    });
    const candidates = await database.presentationCandidate.findMany({
      select: { catalogItemId: true },
    });
    expect(
      new Set(candidates.map((candidate) => candidate.catalogItemId)).size,
    ).toBe(1);
  });

  it("keeps different non-null URLs separate and resolves slug collisions", async () => {
    const first = await createCandidate(database, {
      handle: "@channel_one",
      messageId: 3n,
      name: "Same Name",
      subjectUrl: "https://example.com/one",
    });
    const second = await createCandidate(database, {
      handle: "@channel_two",
      messageId: 4n,
      name: "Same Name",
      subjectUrl: "https://example.com/two",
    });

    await project(database, [first, second]);

    const items = await database.catalogItem.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true },
    });
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.slug)).toContain("same-name");
    expect(
      items.some((item) => /^same-name-[a-f0-9]{8}$/u.test(item.slug)),
    ).toBe(true);
  });

  it("merges normalized fallback identities and backfills idempotently", async () => {
    await createCandidate(database, {
      handle: "@channel_one",
      messageId: 5n,
      name: "Caf\u00e9 Inspector",
      subjectUrl: null,
    });
    await createCandidate(database, {
      handle: "@channel_two",
      messageId: 6n,
      name: "Cafe\u0301   Inspector",
      subjectUrl: null,
    });

    await expect(backfillCatalogProjection(database)).resolves.toBe(2);
    await expect(backfillCatalogProjection(database)).resolves.toBe(0);
    await expect(database.catalogItem.count()).resolves.toBe(1);
    await expect(
      database.presentationCandidate.count({ where: { catalogItemId: null } }),
    ).resolves.toBe(0);
  });

  it("refreshes display selection when channels are disabled and re-enabled", async () => {
    const preferred = await createCandidate(database, {
      handle: "@channel_one",
      messageId: 7n,
      name: "Preferred Name",
      subjectUrl: "https://example.com/shared",
      confidence: 0.99,
    });
    const fallback = await createCandidate(database, {
      handle: "@channel_two",
      messageId: 8n,
      name: "Fallback Name",
      subjectUrl: "https://example.com/shared",
      confidence: 0.75,
    });
    await project(database, [preferred, fallback]);

    await reconcileChannels(database, ["@channel_two"]);
    await expect(database.catalogItem.findFirst()).resolves.toMatchObject({
      name: "Fallback Name",
    });

    await reconcileChannels(database, ["@channel_one", "@channel_two"]);
    await expect(database.catalogItem.findFirst()).resolves.toMatchObject({
      name: "Preferred Name",
    });
  });
});
