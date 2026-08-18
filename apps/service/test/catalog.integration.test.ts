import {
  AnalyzedPostStatus,
  createDbClient,
  type DbClient,
} from "@findthatproject/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  backfillCatalogProjection,
  projectCandidateIds,
  reconcileCatalogProjection,
} from "../src/catalog/projector";
import { deriveCatalogIdentity } from "../src/catalog/identity";
import { reconcileChannels } from "../src/collector/reconcile-channels";

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

interface CandidateInput {
  readonly handle: string;
  readonly messageId: bigint;
  readonly name: string;
  readonly subjectUrl: string | null;
  readonly githubUrl?: string | null;
  readonly kind?: "PROJECT" | "PRODUCT" | "FEATURE";
  readonly parentName?: string | null;
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
      kind: input.kind ?? "PROJECT",
      category: "Developer tools",
      name: input.name,
      parentName: input.parentName ?? null,
      subjectUrl: input.subjectUrl,
      githubUrl: input.githubUrl ?? null,
      descriptionEn: `${input.name} synthetic description.`,
      descriptionRu: `${input.name} — синтетическое описание проекта.`,
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

const linkLegacyCatalogItem = async (
  database: DbClient,
  candidateId: string,
  slug: string,
): Promise<string> => {
  const candidate = await database.presentationCandidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { analyzedPost: { select: { publishedAt: true } } },
  });
  const identity = deriveCatalogIdentity(candidate);
  const item = await database.catalogItem.create({
    data: {
      identityKey: identity.identityKey,
      slug,
      kind: candidate.kind,
      category: candidate.category,
      name: candidate.name,
      nameSortKey: identity.nameSortKey,
      parentName: candidate.parentName,
      canonicalUrl: identity.canonicalUrl,
      githubUrl: candidate.githubUrl,
      descriptionEn: candidate.descriptionEn,
      descriptionRu: candidate.descriptionRu,
      tags: candidate.tags,
      searchText: candidate.name.toLocaleLowerCase("en"),
      firstMentionedAt: candidate.analyzedPost.publishedAt,
      lastMentionedAt: candidate.analyzedPost.publishedAt,
    },
    select: { id: true },
  });
  await database.presentationCandidate.update({
    where: { id: candidateId },
    data: { catalogItemId: item.id },
  });
  return item.id;
};

describe.skipIf(!testDatabaseUrl)("catalog projection integration", () => {
  let database: DbClient;

  beforeAll(() => {
    assertDisposableDatabase(testDatabaseUrl!);
    database = createDbClient(testDatabaseUrl!);
  });

  beforeEach(async () => {
    await database.weeklyDigestRun.deleteMany();
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
      githubUrl: "https://github.com/example/demo-project",
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
      githubUrl: "https://github.com/example/demo-project",
      descriptionRu: "Demo Project Renamed — синтетическое описание проекта.",
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

  it("merges exact normalized titles across different URLs and kinds", async () => {
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
      kind: "PRODUCT",
    });

    await project(database, [first, second]);

    expect(await database.catalogItem.count()).toBe(1);
    expect(await database.catalogIdentityAlias.count()).toBe(3);
    expect(
      new Set(
        (
          await database.presentationCandidate.findMany({
            select: { catalogItemId: true },
          })
        ).map((candidate) => candidate.catalogItemId),
      ).size,
    ).toBe(1);
  });

  it("keeps same-named child features of different parents separate", async () => {
    const first = await createCandidate(database, {
      handle: "@channel_one",
      messageId: 30n,
      name: "Canvas",
      parentName: "Product One",
      kind: "FEATURE",
      subjectUrl: "https://example.com/product-one/canvas",
    });
    const second = await createCandidate(database, {
      handle: "@channel_two",
      messageId: 31n,
      name: "Canvas",
      parentName: "Product Two",
      kind: "FEATURE",
      subjectUrl: "https://example.com/product-two/canvas",
    });

    await project(database, [first, second]);

    expect(await database.catalogItem.count()).toBe(2);
  });

  it("reconciles duplicate catalog rows created before aliases existed", async () => {
    const first = await createCandidate(database, {
      handle: "@channel_one",
      messageId: 40n,
      name: "Legacy Duplicate",
      subjectUrl: "https://example.com/legacy-repository",
    });
    const second = await createCandidate(database, {
      handle: "@channel_two",
      messageId: 41n,
      name: "Legacy Duplicate",
      subjectUrl: "https://legacy.example.com/",
    });
    await linkLegacyCatalogItem(database, first, "legacy-duplicate");
    await linkLegacyCatalogItem(database, second, "legacy-duplicate-old");
    expect(await database.catalogItem.count()).toBe(2);

    await expect(reconcileCatalogProjection(database)).resolves.toBe(2);

    expect(await database.catalogItem.count()).toBe(1);
    expect(await database.catalogIdentityAlias.count()).toBe(3);
    expect(
      new Set(
        (
          await database.presentationCandidate.findMany({
            select: { catalogItemId: true },
          })
        ).map((candidate) => candidate.catalogItemId),
      ).size,
    ).toBe(1);
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
