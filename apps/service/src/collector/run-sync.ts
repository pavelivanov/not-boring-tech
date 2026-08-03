import { IngestionRunStatus, type DbClient } from "@findthatproject/db";

import type { PostAnalyzer } from "../analyzer/types";
import { reconcileCatalogProjection } from "../catalog/projector";
import { collectChannel, FatalAnalysisError } from "./collect-channel";
import { reconcileChannels } from "./reconcile-channels";
import type { TelegramSource } from "./types";

export interface RunSyncConfig {
  readonly channels: readonly string[];
  readonly backfillDays: number;
  readonly pageSize: number;
  readonly modelId: string;
}

export interface RunSyncDependencies {
  readonly database: DbClient;
  readonly telegram: TelegramSource;
  readonly analyzer: PostAnalyzer;
  readonly now?: () => Date;
}

export interface RunSyncResult {
  readonly runId: string;
  readonly status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  readonly failedChannels: number;
}

type SafeChannelOutcome = Record<string, string | number | boolean | null>;

const safeErrorClass = (error: unknown): string => {
  if (error instanceof FatalAnalysisError) return error.errorClass;
  if (error instanceof Error && /^[A-Z][A-Z0-9_]{1,79}$/.test(error.message)) {
    return error.message;
  }
  return "CHANNEL_FAILURE";
};

export const runSync = async (
  config: RunSyncConfig,
  dependencies: RunSyncDependencies,
): Promise<RunSyncResult> => {
  const now = dependencies.now ?? (() => new Date());
  const channels = await reconcileChannels(
    dependencies.database,
    config.channels,
  );
  await reconcileCatalogProjection(dependencies.database);
  const run = await dependencies.database.ingestionRun.create({
    data: {
      configuredChannelCount: channels.length,
      channelOutcomes: {},
    },
  });
  const totals = {
    fetchedCount: 0,
    analyzedCount: 0,
    relevantCount: 0,
    presentationsSaved: 0,
    skippedCount: 0,
    failedCount: 0,
  };
  const channelOutcomes: Record<string, SafeChannelOutcome> = {};
  let failedChannels = 0;
  let connected = false;

  try {
    await dependencies.telegram.connect();
    connected = true;

    for (const channel of channels) {
      try {
        const result = await collectChannel(
          dependencies.database,
          channel,
          dependencies.telegram,
          dependencies.analyzer,
          {
            backfillDays: config.backfillDays,
            pageSize: config.pageSize,
            modelId: config.modelId,
          },
          now(),
        );
        totals.fetchedCount += result.fetched;
        totals.analyzedCount += result.analyzed;
        totals.relevantCount += result.relevant;
        totals.presentationsSaved += result.presentationsSaved;
        totals.skippedCount += result.skipped;
        totals.failedCount += result.failed;
        channelOutcomes[channel.handle] = {
          fetched: result.fetched,
          analyzed: result.analyzed,
          relevant: result.relevant,
          presentationsSaved: result.presentationsSaved,
          skipped: result.skipped,
          failed: result.failed,
          incrementalCursorMessageId: result.incrementalCursorMessageId,
          backfillBeforeMessageId: result.backfillBeforeMessageId,
          backfillCompleted: result.backfillCompleted,
        };
      } catch (error) {
        failedChannels += 1;
        totals.failedCount += 1;
        const errorClass = safeErrorClass(error);
        channelOutcomes[channel.handle] = { errorClass };
        if (error instanceof FatalAnalysisError) throw error;
      }
    }

    const status =
      failedChannels === 0
        ? IngestionRunStatus.SUCCEEDED
        : IngestionRunStatus.PARTIAL;
    await dependencies.database.ingestionRun.update({
      where: { id: run.id },
      data: {
        ...totals,
        channelOutcomes,
        status,
        finishedAt: now(),
      },
    });
    return { runId: run.id, status, failedChannels };
  } catch (error) {
    const errorClass = safeErrorClass(error);
    await dependencies.database.ingestionRun.update({
      where: { id: run.id },
      data: {
        ...totals,
        channelOutcomes,
        status: IngestionRunStatus.FAILED,
        finishedAt: now(),
        failureClass: errorClass,
        failureSummary:
          "Synchronization failed; inspect the safe failure class.",
      },
    });
    return {
      runId: run.id,
      status: "FAILED",
      failedChannels: failedChannels + 1,
    };
  } finally {
    if (connected) await dependencies.telegram.disconnect();
  }
};
