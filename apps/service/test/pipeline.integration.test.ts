import {
  AnalyzedPostStatus,
  acquireSyncAdvisoryLock,
  createDbClient,
  type DbClient,
} from "@findthatproject/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { runSync } from "../src/collector/run-sync";
import { reconcileChannels } from "../src/collector/reconcile-channels";
import type { TelegramPage } from "../src/collector/types";
import type {
  AnalysisOutcome,
  TransientPostInput,
} from "../src/analyzer/types";
import { ScriptedPostAnalyzer } from "./fakes/scripted-post-analyzer";
import { ScriptedTelegramSource } from "./fakes/scripted-telegram-source";

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

const post = (messageId: bigint, text: string): TransientPostInput => ({
  channelHandle: "@notboring_tech",
  messageId,
  text,
  publishedAt: new Date(
    `2026-07-30T10:${String(Number(messageId) % 60).padStart(2, "0")}:00Z`,
  ),
  editedAt: null,
  sourceUrl: `https://t.me/notboring_tech/${messageId}`,
  links: text ? [`https://example.com/${messageId}`] : [],
});

const page = (
  posts: readonly TransientPostInput[],
  reachedBoundary = true,
): TelegramPage => ({
  posts,
  reachedBoundary,
  nextBeforeMessageId: posts[0]?.messageId ?? null,
});

const success = (
  relevant: boolean,
  messageId: bigint,
  kind: "PROJECT" | "FEATURE" = "PROJECT",
): AnalysisOutcome => ({
  type: "success",
  analysis: {
    relevant,
    presentations: relevant
      ? [
          {
            kind,
            category: "Developer tools",
            name: kind === "FEATURE" ? "Channels" : `Project ${messageId}`,
            parentName: kind === "FEATURE" ? "Claude Code" : null,
            subjectUrl: `https://example.com/${messageId}`,
            descriptionEn:
              "A concise synthetic presentation used by the integration suite.",
            tags: ["synthetic"],
            sourceLanguage: "en",
            confidence: 0.9,
          },
        ]
      : [],
  },
  metadata: {
    modelId: "model-a",
    requestId: "req_safe",
    attempts: 1,
    inputTokens: 20,
    outputTokens: 10,
    totalTokens: 30,
  },
});

const multiPresentationSuccess = (messageId: bigint): AnalysisOutcome => ({
  type: "success",
  analysis: {
    relevant: true,
    presentations: [
      {
        kind: "FEATURE",
        category: "Developer tools",
        name: "Review Mode",
        parentName: "CodeDock",
        subjectUrl: `https://example.com/${messageId}`,
        descriptionEn: "A focused patch-review mode.",
        tags: ["review"],
        sourceLanguage: "en",
        confidence: 0.9,
      },
      {
        kind: "PLUGIN",
        category: "Developer tools",
        name: "ReviewMate",
        parentName: null,
        subjectUrl: `https://example.com/${messageId}`,
        descriptionEn: "A plugin with repository-specific review rules.",
        tags: ["plugin"],
        sourceLanguage: "en",
        confidence: 0.88,
      },
    ],
  },
  metadata: {
    modelId: "model-a",
    requestId: "req_multi",
    attempts: 1,
    inputTokens: 30,
    outputTokens: 20,
    totalTokens: 50,
  },
});

const config = (modelId = "model-a") => ({
  channels: ["@notboring_tech"],
  backfillDays: 90,
  pageSize: 10,
  modelId,
});

describe.skipIf(!testDatabaseUrl)("pipeline database integration", () => {
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

  it("persists relevant, irrelevant, and no-text terminal outcomes without source bodies", async () => {
    const posts = [
      post(1n, "A useful project"),
      post(2n, "Generic product news"),
      post(3n, ""),
    ];
    const analyzer = new ScriptedPostAnalyzer([
      success(true, 1n),
      success(false, 2n),
    ]);
    const telegram = new ScriptedTelegramSource({
      liveEdges: { "@notboring_tech": 3n },
      backfillPages: [page(posts)],
    });

    const result = await runSync(config(), {
      database,
      telegram,
      analyzer,
      now: () => new Date("2026-07-31T12:00:00Z"),
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(analyzer.calls.map((call) => call.messageId)).toEqual([1n, 2n]);
    expect(
      await database.analyzedPost.findMany({
        orderBy: { telegramMessageId: "asc" },
        select: { telegramMessageId: true, status: true },
      }),
    ).toEqual([
      { telegramMessageId: 1n, status: AnalyzedPostStatus.PRESENTATIONS_SAVED },
      { telegramMessageId: 2n, status: AnalyzedPostStatus.NOT_RELEVANT },
      { telegramMessageId: 3n, status: AnalyzedPostStatus.SKIPPED_NO_TEXT },
    ]);
    expect(await database.presentationCandidate.count()).toBe(1);
    expect(await database.ingestionRun.findFirstOrThrow()).toMatchObject({
      status: "SUCCEEDED",
      configuredChannelCount: 1,
      fetchedCount: 3,
      analyzedCount: 2,
      relevantCount: 1,
      presentationsSaved: 1,
      skippedCount: 1,
      failedCount: 0,
    });

    const columns = await database.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('AnalyzedPost', 'PresentationCandidate')
    `;
    expect(
      columns
        .map((column) => column.column_name)
        .join(" ")
        .toLowerCase(),
    ).not.toMatch(/messagetext|caption|promptbody|responsebody|rawmessage/);
  });

  it("replays a page after cursor loss without duplicate analysis or candidates", async () => {
    const deliveredPost = post(10n, "A useful project");
    const firstAnalyzer = new ScriptedPostAnalyzer([success(true, 10n)]);
    await runSync(config(), {
      database,
      analyzer: firstAnalyzer,
      telegram: new ScriptedTelegramSource({
        liveEdges: { "@notboring_tech": 10n },
        backfillPages: [page([deliveredPost])],
      }),
    });

    await database.channel.update({
      where: { handle: "@notboring_tech" },
      data: {
        incrementalCursorMessageId: null,
        backfillBeforeMessageId: null,
        backfillCompletedAt: null,
      },
    });
    const replayAnalyzer = new ScriptedPostAnalyzer([]);
    await runSync(config("model-b"), {
      database,
      analyzer: replayAnalyzer,
      telegram: new ScriptedTelegramSource({
        liveEdges: { "@notboring_tech": 10n },
        backfillPages: [page([deliveredPost])],
      }),
    });

    expect(replayAnalyzer.calls).toHaveLength(0);
    expect(await database.presentationCandidate.count()).toBe(1);
    expect(await database.catalogItem.count()).toBe(1);
    expect((await database.analyzedPost.findFirstOrThrow()).modelId).toBe(
      "model-a",
    );
  });

  it("re-analyzes an edited post and removes stale candidates atomically", async () => {
    const original = post(20n, "A useful project");
    await runSync(config(), {
      database,
      analyzer: new ScriptedPostAnalyzer([success(true, 20n)]),
      telegram: new ScriptedTelegramSource({
        liveEdges: { "@notboring_tech": 20n },
        backfillPages: [page([original])],
      }),
    });
    const originalCatalogItem = await database.catalogItem.findFirstOrThrow();

    const edited = {
      ...original,
      text: "This is now only generic news",
      editedAt: new Date(),
    };
    const editAnalyzer = new ScriptedPostAnalyzer([success(false, 20n)]);
    await runSync(config(), {
      database,
      analyzer: editAnalyzer,
      telegram: new ScriptedTelegramSource({
        liveEdges: { "@notboring_tech": 20n },
        recentPages: [page([edited])],
      }),
    });

    expect(editAnalyzer.calls).toHaveLength(1);
    expect(await database.presentationCandidate.count()).toBe(0);
    expect(await database.catalogItem.findMany()).toEqual([
      expect.objectContaining({
        id: originalCatalogItem.id,
        slug: originalCatalogItem.slug,
      }),
    ]);
    expect((await database.analyzedPost.findFirstOrThrow()).status).toBe(
      AnalyzedPostStatus.NOT_RELEVANT,
    );
  });

  it("processes incrementals before resuming an incomplete backfill", async () => {
    await database.channel.create({
      data: {
        handle: "@notboring_tech",
        publicUrl: "https://t.me/notboring_tech",
        incrementalCursorMessageId: 10n,
        backfillBeforeMessageId: 10n,
        backfillCutoffAt: new Date("2026-05-01T00:00:00Z"),
      },
    });
    const analyzer = new ScriptedPostAnalyzer([
      success(true, 11n),
      success(true, 9n),
    ]);
    const telegram = new ScriptedTelegramSource({
      liveEdges: { "@notboring_tech": 11n },
      incrementalPages: [page([post(11n, "New project")])],
      backfillPages: [page([post(9n, "Historical project")])],
    });

    await runSync(config(), { database, telegram, analyzer });
    expect(analyzer.calls.map((call) => call.messageId)).toEqual([11n, 9n]);
    expect(
      (await database.channel.findFirstOrThrow()).incrementalCursorMessageId,
    ).toBe(11n);
  });

  it("excludes overlapping advisory locks", async () => {
    const first = await acquireSyncAdvisoryLock(testDatabaseUrl!);
    const second = await acquireSyncAdvisoryLock(testDatabaseUrl!);
    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    await second.release();
    await first.release();
  });

  it("disables, re-enables, and preserves configured channel state", async () => {
    await reconcileChannels(database, ["@notboring_tech", "@ctodaily"]);
    const original = await database.channel.findUniqueOrThrow({
      where: { handle: "@ctodaily" },
    });
    await database.channel.update({
      where: { id: original.id },
      data: { incrementalCursorMessageId: 42n },
    });

    await reconcileChannels(database, ["@notboring_tech"]);
    expect(
      await database.channel.findUniqueOrThrow({ where: { id: original.id } }),
    ).toMatchObject({ enabled: false, incrementalCursorMessageId: 42n });

    await reconcileChannels(database, ["@ctodaily"]);
    expect(
      await database.channel.findUniqueOrThrow({ where: { id: original.id } }),
    ).toMatchObject({ enabled: true, incrementalCursorMessageId: 42n });
  });

  it("turns a capped transient analysis failure into terminal review state", async () => {
    const analyzer = new ScriptedPostAnalyzer([
      {
        type: "retryable_failure",
        errorClass: "OPENAI_TRANSIENT",
        metadata: {
          modelId: "model-a",
          requestId: "req_retry",
          attempts: 3,
          inputTokens: 30,
          outputTokens: 0,
          totalTokens: 30,
        },
      },
    ]);
    const result = await runSync(config(), {
      database,
      analyzer,
      telegram: new ScriptedTelegramSource({
        liveEdges: { "@notboring_tech": 30n },
        backfillPages: [page([post(30n, "A difficult project")])],
      }),
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(await database.analyzedPost.findFirstOrThrow()).toMatchObject({
      status: AnalyzedPostStatus.REVIEW_REQUIRED,
      errorClass: "OPENAI_TRANSIENT",
      attemptCount: 3,
    });
    expect(await database.presentationCandidate.count()).toBe(0);
    expect(
      (await database.channel.findFirstOrThrow()).backfillCompletedAt,
    ).not.toBeNull();
  });

  it("persists multiple presentation ordinals for one post", async () => {
    await runSync(config(), {
      database,
      analyzer: new ScriptedPostAnalyzer([multiPresentationSuccess(35n)]),
      telegram: new ScriptedTelegramSource({
        liveEdges: { "@notboring_tech": 35n },
        backfillPages: [page([post(35n, "A feature and a plugin")])],
      }),
    });

    expect(
      await database.presentationCandidate.findMany({
        orderBy: { ordinal: "asc" },
        select: {
          ordinal: true,
          kind: true,
          category: true,
          name: true,
          parentName: true,
          catalogItemId: true,
        },
      }),
    ).toEqual([
      {
        ordinal: 0,
        kind: "FEATURE",
        category: "Developer tools",
        name: "Review Mode",
        parentName: "CodeDock",
        catalogItemId: expect.any(String),
      },
      {
        ordinal: 1,
        kind: "PLUGIN",
        category: "Developer tools",
        name: "ReviewMate",
        parentName: null,
        catalogItemId: expect.any(String),
      },
    ]);
  });

  it("fails the run on authentication errors without advancing the cursor", async () => {
    const result = await runSync(config(), {
      database,
      analyzer: new ScriptedPostAnalyzer([
        {
          type: "fatal_failure",
          errorClass: "OPENAI_AUTH",
          metadata: {
            modelId: "model-a",
            requestId: "req_auth",
            attempts: 1,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
          },
        },
      ]),
      telegram: new ScriptedTelegramSource({
        liveEdges: { "@notboring_tech": 40n },
        backfillPages: [page([post(40n, "A project")])],
      }),
    });

    expect(result.status).toBe("FAILED");
    expect(await database.analyzedPost.findFirstOrThrow()).toMatchObject({
      status: AnalyzedPostStatus.RETRYABLE_FAILURE,
      errorClass: "OPENAI_AUTH",
    });
    expect(await database.channel.findFirstOrThrow()).toMatchObject({
      incrementalCursorMessageId: null,
      backfillBeforeMessageId: null,
      backfillCompletedAt: null,
    });
    expect(await database.ingestionRun.findFirstOrThrow()).toMatchObject({
      status: "FAILED",
      failureClass: "OPENAI_AUTH",
    });
  });

  it("records a partial run when one channel fails after another succeeds", async () => {
    class PartiallyFailingSource extends ScriptedTelegramSource {
      override async resolveChannel(handle: string) {
        if (handle === "@ctodaily") throw new Error("TELEGRAM_CHANNEL_FAILURE");
        return super.resolveChannel(handle);
      }
    }

    const result = await runSync(
      { ...config(), channels: ["@notboring_tech", "@ctodaily"] },
      {
        database,
        analyzer: new ScriptedPostAnalyzer([success(true, 50n)]),
        telegram: new PartiallyFailingSource({
          liveEdges: { "@notboring_tech": 50n, "@ctodaily": 50n },
          backfillPages: [page([post(50n, "A useful project")])],
        }),
      },
    );

    expect(result).toMatchObject({ status: "PARTIAL", failedChannels: 1 });
    expect(await database.presentationCandidate.count()).toBe(1);
    expect(await database.ingestionRun.findFirstOrThrow()).toMatchObject({
      status: "PARTIAL",
      configuredChannelCount: 2,
      relevantCount: 1,
      presentationsSaved: 1,
      failedCount: 1,
    });
  });
});
