import {
  AnalyzedPostStatus,
  WeeklyDigestDeliveryStatus,
  WeeklyDigestLanguage,
  WeeklyDigestRunStatus,
  acquireDigestAdvisoryLock,
  createDbClient,
  type DbClient,
} from "@findthatproject/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  publishWeeklyDigest,
  resolveDigestDelivery,
  type DigestCoordinatorConfig,
} from "../src/digest/coordinator";
import {
  TelegramPublishError,
  type TelegramDigestPublisher,
} from "../src/digest/telegram-bot-client";

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

class ScriptedPublisher implements TelegramDigestPublisher {
  readonly calls: Array<{ readonly chatId: string; readonly html: string }> =
    [];
  readonly #outcomes: Array<
    { readonly messageId: bigint; readonly attempts: number } | Error
  >;

  constructor(
    outcomes: Array<
      { readonly messageId: bigint; readonly attempts: number } | Error
    > = [],
  ) {
    this.#outcomes = [...outcomes];
  }

  async sendMessage(input: {
    readonly chatId: string;
    readonly html: string;
  }): Promise<{ readonly messageId: bigint; readonly attempts: number }> {
    this.calls.push(input);
    const outcome = this.#outcomes.shift() ?? {
      messageId: BigInt(this.calls.length),
      attempts: 1,
    };
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }
}

const config = (
  overrides: Partial<DigestCoordinatorConfig> = {},
): DigestCoordinatorConfig => ({
  initialStartAt: new Date("2026-08-10T09:00:00.000Z"),
  siteOrigin: "https://findthatproject.example",
  channelEn: "@digest_en",
  channelRu: "@digest_ru",
  maxAttempts: 3,
  ...overrides,
});

let seedOrdinal = 0;

const createCatalogItem = async (
  database: DbClient,
  input: {
    readonly slug: string;
    readonly createdAt: Date;
    readonly visible?: boolean;
    readonly channelEnabled?: boolean;
    readonly descriptionRu?: string | null;
  },
): Promise<string> => {
  seedOrdinal += 1;
  const suffix = seedOrdinal.toString(16).padStart(64, "0");
  const item = await database.catalogItem.create({
    data: {
      identityKey: `url:${suffix}`,
      slug: input.slug,
      kind: "PROJECT",
      category: "Developer tools",
      name: `Project ${input.slug}`,
      nameRu: `Проект ${input.slug}`,
      nameSortKey: `project ${input.slug}`,
      parentName: null,
      parentNameRu: null,
      canonicalUrl: `https://example.com/${input.slug}`,
      githubUrl: `https://github.com/example/${input.slug}`,
      descriptionEn: `English description for ${input.slug}.`,
      descriptionRu:
        input.descriptionRu === undefined
          ? `Русское описание проекта ${input.slug}.`
          : input.descriptionRu,
      tags: ["synthetic"],
      searchText: `project ${input.slug}`,
      githubRepository: `example/${input.slug}`,
      githubStars: 0,
      firstMentionedAt: input.createdAt,
      lastMentionedAt: input.createdAt,
      createdAt: input.createdAt,
    },
    select: { id: true },
  });
  if (input.visible ?? true) {
    await makeCatalogItemVisible(
      database,
      item.id,
      input.slug,
      input.createdAt,
      input.channelEnabled ?? true,
      input.descriptionRu === undefined
        ? `Русское описание проекта ${input.slug}.`
        : input.descriptionRu,
    );
  }
  return item.id;
};

const makeCatalogItemVisible = async (
  database: DbClient,
  catalogItemId: string,
  slug: string,
  publishedAt: Date,
  enabled = true,
  descriptionRu: string | null = `Русское описание проекта ${slug}.`,
): Promise<void> => {
  seedOrdinal += 1;
  const handle = `@digest_seed_${seedOrdinal}`;
  const channel = await database.channel.create({
    data: {
      handle,
      publicUrl: `https://t.me/${handle.slice(1)}`,
      enabled,
    },
    select: { id: true },
  });
  const post = await database.analyzedPost.create({
    data: {
      channelId: channel.id,
      telegramMessageId: BigInt(seedOrdinal),
      sourceUrl: `https://t.me/${handle.slice(1)}/${seedOrdinal}`,
      publishedAt,
      contentHash: seedOrdinal.toString(16).padStart(64, "0"),
      status: AnalyzedPostStatus.PRESENTATIONS_SAVED,
      promptVersion: "digest-test-prompt",
      schemaVersion: "digest-test-schema",
      analysisVersion: "digest-test-analysis",
      modelId: "digest-test-model",
    },
    select: { id: true },
  });
  await database.presentationCandidate.create({
    data: {
      analyzedPostId: post.id,
      ordinal: 0,
      kind: "PROJECT",
      category: "Developer tools",
      name: `Project ${slug}`,
      nameRu: `Проект ${slug}`,
      parentNameRu: null,
      subjectUrl: `https://example.com/${slug}`,
      githubUrl: `https://github.com/example/${slug}`,
      descriptionEn: `English description for ${slug}.`,
      descriptionRu,
      tags: ["synthetic"],
      sourceLanguage: "en",
      confidence: 0.9,
      catalogItemId,
    },
  });
};

describe.skipIf(!testDatabaseUrl)("weekly digest integration", () => {
  let database: DbClient;

  beforeAll(() => {
    assertDisposableDatabase(testDatabaseUrl!);
    database = createDbClient(testDatabaseUrl!);
  });

  beforeEach(async () => {
    seedOrdinal = 0;
    await database.weeklyDigestRun.deleteMany();
    await database.presentationCandidate.deleteMany();
    await database.catalogIdentityAlias.deleteMany();
    await database.catalogItem.deleteMany();
    await database.analyzedPost.deleteMany();
    await database.channel.deleteMany();
    await database.ingestionRun.deleteMany();
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("selects never-snapshotted visible items and carries delayed visibility forward once", async () => {
    await createCatalogItem(database, {
      slug: "before-floor",
      createdAt: new Date("2026-08-09T10:00:00.000Z"),
    });
    const firstItemId = await createCatalogItem(database, {
      slug: "first-visible",
      createdAt: new Date("2026-08-11T10:00:00.000Z"),
    });
    const delayedItemId = await createCatalogItem(database, {
      slug: "delayed",
      createdAt: new Date("2026-08-12T10:00:00.000Z"),
      visible: false,
    });
    await createCatalogItem(database, {
      slug: "after-window",
      createdAt: new Date("2026-08-18T10:00:00.000Z"),
    });

    const firstPublisher = new ScriptedPublisher();
    const first = await publishWeeklyDigest(config(), {
      database,
      publisher: firstPublisher,
      now: () => new Date("2026-08-17T09:00:00.000Z"),
    });
    expect(first).toMatchObject({
      itemCount: 1,
      status: WeeklyDigestRunStatus.SUCCEEDED,
      sentCounts: { EN: 1, RU: 1 },
    });
    expect(firstPublisher.calls).toHaveLength(2);
    await expect(
      database.weeklyDigestItem.findMany({
        where: { digestRunId: first.runId! },
        select: { catalogItemId: true, name: true },
      }),
    ).resolves.toEqual([
      { catalogItemId: firstItemId, name: "Project first-visible" },
    ]);

    await database.catalogItem.update({
      where: { id: firstItemId },
      data: { name: "Edited after snapshot" },
    });
    await database.catalogItem.delete({ where: { id: firstItemId } });
    await expect(
      database.weeklyDigestItem.findFirstOrThrow({
        where: { digestRunId: first.runId! },
        select: { catalogItemId: true, name: true },
      }),
    ).resolves.toEqual({
      catalogItemId: null,
      name: "Project first-visible",
    });

    await makeCatalogItemVisible(
      database,
      delayedItemId,
      "delayed",
      new Date("2026-08-12T10:00:00.000Z"),
    );
    const second = await publishWeeklyDigest(config(), {
      database,
      publisher: new ScriptedPublisher(),
      now: () => new Date("2026-08-24T09:00:00.000Z"),
    });
    expect(second).toMatchObject({
      itemCount: 2,
      windowStart: "2026-08-17T09:00:00.000Z",
      status: WeeklyDigestRunStatus.SUCCEEDED,
    });
    const secondSnapshots = await database.weeklyDigestItem.findMany({
      where: { digestRunId: second.runId! },
      orderBy: { ordinal: "asc" },
      select: { catalogItemId: true },
    });
    expect(secondSnapshots).toEqual([
      { catalogItemId: delayedItemId },
      {
        catalogItemId: await database.catalogItem
          .findUniqueOrThrow({ where: { slug: "after-window" } })
          .then((item) => item.id),
      },
    ]);
    await expect(database.weeklyDigestItem.count()).resolves.toBe(3);
  });

  it("publishes localized empty weeks and treats an early repeat as a no-op", async () => {
    const publisher = new ScriptedPublisher();
    const first = await publishWeeklyDigest(config(), {
      database,
      publisher,
      now: () => new Date("2026-08-17T09:00:00.000Z"),
    });
    expect(first).toMatchObject({ itemCount: 0, status: "SUCCEEDED" });
    expect(publisher.calls[0]?.html).toContain("No new items this week.");
    expect(publisher.calls[1]?.html).toContain(
      "На этой неделе новых проектов нет.",
    );

    const repeatPublisher = new ScriptedPublisher();
    const repeat = await publishWeeklyDigest(config(), {
      database,
      publisher: repeatPublisher,
      now: () => new Date("2026-08-18T09:00:00.000Z"),
    });
    expect(repeat.status).toBe("NOOP");
    expect(repeatPublisher.calls).toHaveLength(0);
  });

  it("resumes only the failed language without repeating a sent delivery", async () => {
    await createCatalogItem(database, {
      slug: "partial",
      createdAt: new Date("2026-08-12T10:00:00.000Z"),
    });
    const firstPublisher = new ScriptedPublisher([
      { messageId: 11n, attempts: 1 },
      new TelegramPublishError("TELEGRAM_TARGET", false, 1),
    ]);
    const first = await publishWeeklyDigest(config(), {
      database,
      publisher: firstPublisher,
      now: () => new Date("2026-08-17T09:00:00.000Z"),
    });
    expect(first).toMatchObject({
      status: WeeklyDigestRunStatus.PARTIAL,
      sentCounts: { EN: 1, RU: 0 },
      failureClass: "TELEGRAM_TARGET",
    });

    const resumePublisher = new ScriptedPublisher([
      { messageId: 12n, attempts: 1 },
    ]);
    const resumed = await publishWeeklyDigest(config(), {
      database,
      publisher: resumePublisher,
      now: () => new Date("2026-08-17T10:00:00.000Z"),
    });
    expect(resumed).toMatchObject({
      runId: first.runId,
      status: WeeklyDigestRunStatus.SUCCEEDED,
      sentCounts: { EN: 1, RU: 1 },
    });
    expect(resumePublisher.calls.map((call) => call.chatId)).toEqual([
      "@digest_ru",
    ]);
  });

  it("resumes split parts without repeating an earlier sent part", async () => {
    for (let ordinal = 0; ordinal < 60; ordinal += 1) {
      await createCatalogItem(database, {
        slug: `split-${ordinal.toString().padStart(2, "0")}`,
        createdAt: new Date(
          `2026-08-${String(11 + Math.floor(ordinal / 20)).padStart(2, "0")}T${String(ordinal % 20).padStart(2, "0")}:00:00.000Z`,
        ),
      });
    }
    const firstPublisher = new ScriptedPublisher([
      { messageId: 31n, attempts: 1 },
      new TelegramPublishError("TELEGRAM_SERVER", false, 1),
    ]);
    const first = await publishWeeklyDigest(config(), {
      database,
      publisher: firstPublisher,
      now: () => new Date("2026-08-17T09:00:00.000Z"),
    });
    expect(first.partCounts.EN).toBeGreaterThan(1);
    expect(first.sentCounts.EN).toBe(1);
    const firstSentHtml = firstPublisher.calls[0]?.html;

    const resumePublisher = new ScriptedPublisher();
    const resumed = await publishWeeklyDigest(config(), {
      database,
      publisher: resumePublisher,
      now: () => new Date("2026-08-17T10:00:00.000Z"),
    });
    expect(resumed.status).toBe(WeeklyDigestRunStatus.SUCCEEDED);
    expect(resumePublisher.calls).not.toHaveLength(0);
    expect(
      resumePublisher.calls.every((call) => call.chatId === "@digest_en"),
    ).toBe(true);
    expect(
      resumePublisher.calls.some((call) => call.html === firstSentHtml),
    ).toBe(false);
  });

  it("requires manual resolution after an ambiguous send", async () => {
    await createCatalogItem(database, {
      slug: "ambiguous",
      createdAt: new Date("2026-08-12T10:00:00.000Z"),
    });
    const publisher = new ScriptedPublisher([
      new Error("connection-loss-private-detail"),
      { messageId: 22n, attempts: 1 },
    ]);
    const result = await publishWeeklyDigest(config(), {
      database,
      publisher,
      now: () => new Date("2026-08-17T09:00:00.000Z"),
    });
    expect(result).toMatchObject({
      status: WeeklyDigestRunStatus.REVIEW_REQUIRED,
      failureClass: "TELEGRAM_AMBIGUOUS",
    });
    const ambiguous = await database.weeklyDigestDelivery.findFirstOrThrow({
      where: {
        digestRunId: result.runId!,
        status: WeeklyDigestDeliveryStatus.REVIEW_REQUIRED,
      },
    });

    const reset = await resolveDigestDelivery(
      database,
      { deliveryId: ambiguous.id, outcome: "unsent" },
      new Date("2026-08-17T10:00:00.000Z"),
    );
    expect(reset.status).toBe(WeeklyDigestRunStatus.PARTIAL);
    const resumePublisher = new ScriptedPublisher([
      { messageId: 23n, attempts: 1 },
    ]);
    const resumed = await publishWeeklyDigest(config(), {
      database,
      publisher: resumePublisher,
      now: () => new Date("2026-08-17T11:00:00.000Z"),
    });
    expect(resumed.status).toBe(WeeklyDigestRunStatus.SUCCEEDED);
    expect(resumePublisher.calls).toHaveLength(1);
  });

  it("moves an inherited SENDING delivery to review without publishing", async () => {
    const run = await database.weeklyDigestRun.create({
      data: {
        eligibilityStartAt: new Date("2026-08-10T09:00:00.000Z"),
        windowStart: new Date("2026-08-10T09:00:00.000Z"),
        windowEnd: new Date("2026-08-17T09:00:00.000Z"),
        itemCount: 0,
      },
    });
    await database.weeklyDigestDelivery.create({
      data: {
        digestRunId: run.id,
        language: WeeklyDigestLanguage.EN,
        partIndex: 0,
        targetChatId: "@digest_en",
        renderedHtml: "safe prepared HTML",
        status: WeeklyDigestDeliveryStatus.SENDING,
        attemptCount: 1,
      },
    });
    const publisher = new ScriptedPublisher();

    const result = await publishWeeklyDigest(config(), {
      database,
      publisher,
      now: () => new Date("2026-08-17T10:00:00.000Z"),
    });
    expect(result).toMatchObject({
      status: WeeklyDigestRunStatus.REVIEW_REQUIRED,
      failureClass: "TELEGRAM_AMBIGUOUS_PREVIOUS_SEND",
    });
    expect(publisher.calls).toHaveLength(0);

    const delivery = await database.weeklyDigestDelivery.findFirstOrThrow({
      where: { digestRunId: run.id },
    });
    const resolved = await resolveDigestDelivery(
      database,
      { deliveryId: delivery.id, outcome: "sent", messageId: 99n },
      new Date("2026-08-17T11:00:00.000Z"),
    );
    expect(resolved.status).toBe(WeeklyDigestRunStatus.SUCCEEDED);
    await expect(
      database.weeklyDigestDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
        select: { telegramMessageId: true, resolvedAt: true },
      }),
    ).resolves.toMatchObject({
      telegramMessageId: 99n,
      resolvedAt: new Date("2026-08-17T11:00:00.000Z"),
    });
  });

  it("marks missing Russian metadata for review without preparing deliveries", async () => {
    await createCatalogItem(database, {
      slug: "missing-russian",
      createdAt: new Date("2026-08-12T10:00:00.000Z"),
      descriptionRu: null,
    });
    const result = await publishWeeklyDigest(config(), {
      database,
      publisher: new ScriptedPublisher(),
      now: () => new Date("2026-08-17T09:00:00.000Z"),
    });
    expect(result).toMatchObject({
      status: WeeklyDigestRunStatus.REVIEW_REQUIRED,
      failureClass: "DIGEST_MISSING_RUSSIAN_DESCRIPTION",
      partCounts: { EN: 0, RU: 0 },
    });
  });

  it("uses a distinct PostgreSQL advisory lock for digest execution", async () => {
    const first = await acquireDigestAdvisoryLock(testDatabaseUrl!);
    expect(first.acquired).toBe(true);
    const second = await acquireDigestAdvisoryLock(testDatabaseUrl!);
    expect(second.acquired).toBe(false);
    await second.release();
    await first.release();

    const afterRelease = await acquireDigestAdvisoryLock(testDatabaseUrl!);
    expect(afterRelease.acquired).toBe(true);
    await afterRelease.release();
  });
});
