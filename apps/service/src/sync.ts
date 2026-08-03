import { acquireSyncAdvisoryLock, createDbClient } from "@findthatproject/db";

import { createOpenAiPostAnalyzer } from "./analyzer/openai-post-analyzer";
import { runSync } from "./collector/run-sync";
import { ConfigError, parseSyncConfig } from "./config";
import { refreshGitHubStars } from "./github/refresh-stars";
import { createGramJsTelegramSource } from "./telegram/gramjs-client";

export const ALREADY_RUNNING_EXIT_CODE = 75;
export const PARTIAL_RUN_EXIT_CODE = 2;

const main = async (): Promise<void> => {
  const config = parseSyncConfig();
  const database = createDbClient(config.DATABASE_URL);
  const lock = await acquireSyncAdvisoryLock(config.DATABASE_URL);

  if (!lock.acquired) {
    await database.$disconnect();
    process.exitCode = ALREADY_RUNNING_EXIT_CODE;
    return;
  }

  try {
    const result = await runSync(
      {
        channels: config.TELEGRAM_CHANNELS,
        backfillDays: config.TELEGRAM_BACKFILL_DAYS,
        pageSize: config.TELEGRAM_PAGE_SIZE,
        modelId: config.OPENAI_MODEL,
      },
      {
        database,
        telegram: createGramJsTelegramSource({
          apiId: config.TELEGRAM_API_ID,
          apiHash: config.TELEGRAM_API_HASH,
          session: config.TELEGRAM_SESSION,
        }),
        analyzer: createOpenAiPostAnalyzer(config.OPENAI_API_KEY, {
          modelId: config.OPENAI_MODEL,
          requestTimeoutMs: config.OPENAI_REQUEST_TIMEOUT_MS,
          maxAttempts: config.OPENAI_MAX_ATTEMPTS,
        }),
      },
    );
    const github = await refreshGitHubStars(database, {
      ...(config.GITHUB_TOKEN ? { token: config.GITHUB_TOKEN } : {}),
    });
    process.stdout.write(
      `${JSON.stringify({ runId: result.runId, status: result.status, failedChannels: result.failedChannels, github })}\n`,
    );
    if (result.status === "PARTIAL") process.exitCode = PARTIAL_RUN_EXIT_CODE;
    if (result.status === "FAILED") process.exitCode = 1;
  } finally {
    await lock.release();
    await database.$disconnect();
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    const errorClass =
      error instanceof ConfigError
        ? "CONFIG_INVALID"
        : error instanceof Error && /^[A-Z][A-Z0-9_]{1,79}$/.test(error.message)
          ? error.message
          : "UNEXPECTED_FAILURE";
    process.stderr.write(`${errorClass}\n`);
    process.exitCode = 1;
  });
}
