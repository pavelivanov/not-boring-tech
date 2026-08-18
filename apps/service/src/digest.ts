import {
  acquireDigestAdvisoryLock,
  createDbClient,
  type AdvisoryLock,
  type DbClient,
} from "@findthatproject/db";

import { ConfigError, parseDigestConfig } from "./config";
import {
  publishWeeklyDigest,
  resolveDigestDelivery,
  type DigestPublishResult,
  type ResolveDigestDeliveryInput,
} from "./digest/coordinator";
import { TelegramBotApiClient } from "./digest/telegram-bot-client";

export const DIGEST_ALREADY_RUNNING_EXIT_CODE = 75;
export const DIGEST_PARTIAL_EXIT_CODE = 2;
export const DIGEST_REVIEW_EXIT_CODE = 3;

const HELP = `Usage: digest [publish]
       digest resolve --delivery-id <uuid> --outcome sent --message-id <positive-integer>
       digest resolve --delivery-id <uuid> --outcome unsent

Commands:
  publish  Prepare or resume the weekly EN/RU digest (default)
  resolve  Resolve one ambiguous delivery after checking the target channel
`;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseResolveArguments = (
  arguments_: readonly string[],
): ResolveDigestDeliveryInput => {
  let deliveryId: string | undefined;
  let outcome: "sent" | "unsent" | undefined;
  let messageId: bigint | undefined;
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (!flag || value === undefined) throw new Error("DIGEST_CLI_INVALID");
    if (flag === "--delivery-id" && UUID_PATTERN.test(value)) {
      deliveryId = value;
      continue;
    }
    if (flag === "--outcome" && (value === "sent" || value === "unsent")) {
      outcome = value;
      continue;
    }
    if (flag === "--message-id" && /^\d+$/u.test(value)) {
      messageId = BigInt(value);
      continue;
    }
    throw new Error("DIGEST_CLI_INVALID");
  }
  if (
    deliveryId === undefined ||
    outcome === undefined ||
    (outcome === "sent" && (messageId === undefined || messageId <= 0n)) ||
    (outcome === "unsent" && messageId !== undefined)
  ) {
    throw new Error("DIGEST_CLI_INVALID");
  }
  return {
    deliveryId,
    outcome,
    ...(messageId === undefined ? {} : { messageId }),
  };
};

const exitCodeFor = (result: DigestPublishResult): number => {
  if (result.status === "REVIEW_REQUIRED") return DIGEST_REVIEW_EXIT_CODE;
  if (result.status === "PENDING" || result.status === "PARTIAL") {
    return DIGEST_PARTIAL_EXIT_CODE;
  }
  return 0;
};

const runOperationalCommand = async (
  command: "publish" | "resolve",
  commandArguments: readonly string[],
): Promise<void> => {
  const config = parseDigestConfig();
  let database: DbClient | null = null;
  let lock: AdvisoryLock | null = null;
  try {
    database = createDbClient(config.DATABASE_URL);
    lock = await acquireDigestAdvisoryLock(config.DATABASE_URL);
    if (!lock.acquired) {
      process.exitCode = DIGEST_ALREADY_RUNNING_EXIT_CODE;
      return;
    }

    const result =
      command === "publish"
        ? await publishWeeklyDigest(
            {
              initialStartAt: config.DIGEST_INITIAL_START_AT,
              siteOrigin: config.DIGEST_SITE_ORIGIN,
              channelEn: config.TELEGRAM_DIGEST_CHANNEL_EN,
              channelRu: config.TELEGRAM_DIGEST_CHANNEL_RU,
              maxAttempts: config.DIGEST_MAX_ATTEMPTS,
            },
            {
              database,
              publisher: new TelegramBotApiClient({
                token: config.TELEGRAM_DIGEST_BOT_TOKEN,
                requestTimeoutMs: config.DIGEST_REQUEST_TIMEOUT_MS,
                maxAttempts: config.DIGEST_MAX_ATTEMPTS,
              }),
            },
          )
        : await resolveDigestDelivery(
            database,
            parseResolveArguments(commandArguments),
          );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = exitCodeFor(result);
  } finally {
    await lock?.release();
    await database?.$disconnect();
  }
};

export const main = async (
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> => {
  if (arguments_.includes("--help") || arguments_.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  const [first, ...rest] = arguments_;
  if (first === undefined || first === "publish") {
    if (rest.length > 0) throw new Error("DIGEST_CLI_INVALID");
    await runOperationalCommand("publish", []);
    return;
  }
  if (first === "resolve") {
    await runOperationalCommand("resolve", rest);
    return;
  }
  throw new Error("DIGEST_CLI_INVALID");
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
