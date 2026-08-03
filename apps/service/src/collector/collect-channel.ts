import { createHash } from "node:crypto";

import {
  AnalyzedPostStatus,
  type Channel,
  type DbClient,
  type DbTransaction,
} from "@findthatproject/db";

import {
  PROMPT_VERSION,
  SCHEMA_VERSION,
  createAnalysisVersion,
} from "../analyzer/prompt";
import type {
  AnalysisMetadata,
  PostAnalyzer,
  TransientPostInput,
} from "../analyzer/types";
import { projectCandidateIds, refreshCatalogItems } from "../catalog/projector";
import type { TelegramPage, TelegramSource } from "./types";

const TERMINAL_STATUSES = new Set<AnalyzedPostStatus>([
  AnalyzedPostStatus.PRESENTATIONS_SAVED,
  AnalyzedPostStatus.NOT_RELEVANT,
  AnalyzedPostStatus.SKIPPED_NO_TEXT,
  AnalyzedPostStatus.REVIEW_REQUIRED,
]);

export interface ChannelCollectionConfig {
  readonly backfillDays: number;
  readonly pageSize: number;
  readonly modelId: string;
}

export interface ChannelCollectionCounts {
  fetched: number;
  analyzed: number;
  relevant: number;
  presentationsSaved: number;
  skipped: number;
  failed: number;
}

export interface ChannelCollectionResult extends ChannelCollectionCounts {
  readonly incrementalCursorMessageId: string | null;
  readonly backfillBeforeMessageId: string | null;
  readonly backfillCompleted: boolean;
}

export class FatalAnalysisError extends Error {
  readonly errorClass: string;

  constructor(errorClass: string) {
    super(errorClass);
    this.name = "FatalAnalysisError";
    this.errorClass = errorClass;
  }
}

const emptyCounts = (): ChannelCollectionCounts => ({
  fetched: 0,
  analyzed: 0,
  relevant: 0,
  presentationsSaved: 0,
  skipped: 0,
  failed: 0,
});

const addCounts = (
  target: ChannelCollectionCounts,
  source: ChannelCollectionCounts,
): void => {
  target.fetched += source.fetched;
  target.analyzed += source.analyzed;
  target.relevant += source.relevant;
  target.presentationsSaved += source.presentationsSaved;
  target.skipped += source.skipped;
  target.failed += source.failed;
};

export const contentHashForPost = (post: TransientPostInput): string => {
  const text = post.text.replaceAll("\r\n", "\n").trim();
  const links = [...new Set(post.links)].sort();
  return createHash("sha256")
    .update(JSON.stringify({ text, links }))
    .digest("hex");
};

const metadataFields = (
  metadata: AnalysisMetadata | null,
  fallbackModelId: string,
) => ({
  modelId: metadata?.modelId ?? fallbackModelId,
  attemptCount: metadata?.attempts ?? 0,
  inputTokens: metadata?.inputTokens ?? null,
  outputTokens: metadata?.outputTokens ?? null,
  totalTokens: metadata?.totalTokens ?? null,
  openAiRequestId: metadata?.requestId ?? null,
});

const deletePostCandidates = async (
  transaction: DbTransaction,
  analyzedPostId: string,
): Promise<void> => {
  const linkedItems = await transaction.presentationCandidate.findMany({
    where: { analyzedPostId, catalogItemId: { not: null } },
    select: { catalogItemId: true },
  });
  await transaction.presentationCandidate.deleteMany({
    where: { analyzedPostId },
  });
  await refreshCatalogItems(
    transaction,
    linkedItems.flatMap((candidate) =>
      candidate.catalogItemId === null ? [] : [candidate.catalogItemId],
    ),
  );
};

const processPost = async (
  database: DbClient,
  channel: Channel,
  analyzer: PostAnalyzer,
  post: TransientPostInput,
  modelId: string,
): Promise<ChannelCollectionCounts> => {
  const counts = emptyCounts();
  counts.fetched = 1;
  const contentHash = contentHashForPost(post);
  const analysisVersion = createAnalysisVersion(modelId);
  const existing = await database.analyzedPost.findUnique({
    where: {
      channelId_telegramMessageId: {
        channelId: channel.id,
        telegramMessageId: post.messageId,
      },
    },
    select: { id: true, contentHash: true, status: true },
  });

  if (
    existing?.contentHash === contentHash &&
    TERMINAL_STATUSES.has(existing.status)
  ) {
    counts.skipped = 1;
    return counts;
  }

  const baseCreate = {
    channelId: channel.id,
    telegramMessageId: post.messageId,
    sourceUrl: post.sourceUrl,
    publishedAt: post.publishedAt,
    editedAt: post.editedAt,
    contentHash,
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    analysisVersion,
    modelId,
  };

  if (!post.text.trim()) {
    await database.$transaction(async (transaction) => {
      const ledger = await transaction.analyzedPost.upsert({
        where: {
          channelId_telegramMessageId: {
            channelId: channel.id,
            telegramMessageId: post.messageId,
          },
        },
        create: {
          ...baseCreate,
          status: AnalyzedPostStatus.SKIPPED_NO_TEXT,
        },
        update: {
          sourceUrl: post.sourceUrl,
          editedAt: post.editedAt,
          contentHash,
          status: AnalyzedPostStatus.SKIPPED_NO_TEXT,
          promptVersion: PROMPT_VERSION,
          schemaVersion: SCHEMA_VERSION,
          analysisVersion,
          modelId,
          attemptCount: 0,
          analyzedAt: new Date(),
          errorClass: null,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          openAiRequestId: null,
        },
      });
      await deletePostCandidates(transaction, ledger.id);
    });
    counts.skipped = 1;
    return counts;
  }

  const outcome = await analyzer.analyze(post);
  counts.analyzed = 1;
  const metadata = metadataFields(outcome.metadata, modelId);

  if (outcome.type !== "success") {
    const status =
      outcome.type === "fatal_failure"
        ? AnalyzedPostStatus.RETRYABLE_FAILURE
        : AnalyzedPostStatus.REVIEW_REQUIRED;
    await database.$transaction(async (transaction) => {
      const ledger = await transaction.analyzedPost.upsert({
        where: {
          channelId_telegramMessageId: {
            channelId: channel.id,
            telegramMessageId: post.messageId,
          },
        },
        create: {
          ...baseCreate,
          ...metadata,
          status,
          errorClass: outcome.errorClass,
        },
        update: {
          sourceUrl: post.sourceUrl,
          editedAt: post.editedAt,
          contentHash,
          status,
          promptVersion: PROMPT_VERSION,
          schemaVersion: SCHEMA_VERSION,
          analysisVersion,
          ...metadata,
          analyzedAt: new Date(),
          errorClass: outcome.errorClass,
        },
      });
      if (status === AnalyzedPostStatus.REVIEW_REQUIRED) {
        await deletePostCandidates(transaction, ledger.id);
      }
    });
    counts.failed = 1;
    if (outcome.type === "fatal_failure") {
      throw new FatalAnalysisError(outcome.errorClass);
    }
    return counts;
  }

  const status = outcome.analysis.relevant
    ? AnalyzedPostStatus.PRESENTATIONS_SAVED
    : AnalyzedPostStatus.NOT_RELEVANT;
  await database.$transaction(async (transaction) => {
    const ledger = await transaction.analyzedPost.upsert({
      where: {
        channelId_telegramMessageId: {
          channelId: channel.id,
          telegramMessageId: post.messageId,
        },
      },
      create: { ...baseCreate, ...metadata, status, errorClass: null },
      update: {
        sourceUrl: post.sourceUrl,
        editedAt: post.editedAt,
        contentHash,
        status,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        analysisVersion,
        ...metadata,
        analyzedAt: new Date(),
        errorClass: null,
      },
    });
    const oldItemIds = await transaction.presentationCandidate.findMany({
      where: { analyzedPostId: ledger.id, catalogItemId: { not: null } },
      select: { catalogItemId: true },
    });
    await transaction.presentationCandidate.deleteMany({
      where: { analyzedPostId: ledger.id },
    });
    if (outcome.analysis.presentations.length > 0) {
      await transaction.presentationCandidate.createMany({
        data: outcome.analysis.presentations.map((presentation, ordinal) => ({
          analyzedPostId: ledger.id,
          ordinal,
          kind: presentation.kind,
          category: presentation.category,
          name: presentation.name,
          parentName: presentation.parentName,
          subjectUrl: presentation.subjectUrl,
          descriptionEn: presentation.descriptionEn,
          tags: [...presentation.tags],
          sourceLanguage: presentation.sourceLanguage,
          confidence: presentation.confidence,
        })),
      });
      const createdCandidates =
        await transaction.presentationCandidate.findMany({
          where: { analyzedPostId: ledger.id },
          select: { id: true },
        });
      await projectCandidateIds(
        transaction,
        createdCandidates.map((candidate) => candidate.id),
      );
    }
    await refreshCatalogItems(
      transaction,
      oldItemIds.flatMap((candidate) =>
        candidate.catalogItemId === null ? [] : [candidate.catalogItemId],
      ),
    );
  });

  if (outcome.analysis.relevant) {
    counts.relevant = 1;
    counts.presentationsSaved = outcome.analysis.presentations.length;
  }
  return counts;
};

const processPage = async (
  database: DbClient,
  channel: Channel,
  analyzer: PostAnalyzer,
  page: TelegramPage,
  modelId: string,
): Promise<ChannelCollectionCounts> => {
  const counts = emptyCounts();
  for (const post of page.posts) {
    addCounts(
      counts,
      await processPost(database, channel, analyzer, post, modelId),
    );
  }
  return counts;
};

export const collectChannel = async (
  database: DbClient,
  channel: Channel,
  source: TelegramSource,
  analyzer: PostAnalyzer,
  config: ChannelCollectionConfig,
  now: Date,
): Promise<ChannelCollectionResult> => {
  const counts = emptyCounts();
  const resolved = await source.resolveChannel(channel.handle);
  const cutoffAt =
    channel.backfillCutoffAt ??
    new Date(now.getTime() - config.backfillDays * 24 * 60 * 60 * 1_000);
  let state = await database.channel.update({
    where: { id: channel.id },
    data: {
      telegramPeerId: resolved.telegramPeerId,
      title: resolved.title,
      publicUrl: resolved.publicUrl,
      backfillCutoffAt: cutoffAt,
    },
  });
  const recentEditScanThrough =
    state.backfillCompletedAt === null
      ? null
      : state.incrementalCursorMessageId;

  const liveEdge = await source.captureLiveEdge(resolved);
  if (liveEdge !== null && state.incrementalCursorMessageId !== null) {
    let cursor = state.incrementalCursorMessageId;
    while (cursor < liveEdge) {
      const page = await source.getIncrementalPage(
        resolved,
        cursor,
        liveEdge,
        config.pageSize,
      );
      addCounts(
        counts,
        await processPage(database, state, analyzer, page, config.modelId),
      );
      const lastProcessedId = page.posts.at(-1)?.messageId ?? liveEdge;
      cursor = lastProcessedId;
      state = await database.channel.update({
        where: { id: channel.id },
        data: { incrementalCursorMessageId: cursor, lastCollectedAt: now },
      });
      if (page.reachedBoundary) break;
      if (page.posts.length === 0)
        throw new Error("TELEGRAM_INCREMENTAL_CURSOR_STALLED");
    }
  }

  while (state.backfillCompletedAt === null) {
    const page = await source.getBackfillPage(
      resolved,
      state.backfillBeforeMessageId,
      cutoffAt,
      config.pageSize,
    );
    addCounts(
      counts,
      await processPage(database, state, analyzer, page, config.modelId),
    );

    const nextBeforeMessageId = page.nextBeforeMessageId;
    state = await database.channel.update({
      where: { id: channel.id },
      data: {
        incrementalCursorMessageId:
          state.incrementalCursorMessageId ?? liveEdge,
        backfillBeforeMessageId: nextBeforeMessageId,
        backfillCompletedAt: page.reachedBoundary ? now : null,
        lastCollectedAt: now,
      },
    });
    if (page.reachedBoundary) break;
    if (nextBeforeMessageId === null)
      throw new Error("TELEGRAM_BACKFILL_CURSOR_STALLED");
  }

  if (recentEditScanThrough !== null) {
    const recentPage = await source.getRecentPage(
      resolved,
      recentEditScanThrough,
      config.pageSize,
    );
    addCounts(
      counts,
      await processPage(database, state, analyzer, recentPage, config.modelId),
    );
    state = await database.channel.update({
      where: { id: channel.id },
      data: { lastCollectedAt: now },
    });
  }

  return {
    ...counts,
    incrementalCursorMessageId:
      state.incrementalCursorMessageId?.toString() ?? null,
    backfillBeforeMessageId: state.backfillBeforeMessageId?.toString() ?? null,
    backfillCompleted: state.backfillCompletedAt !== null,
  };
};
