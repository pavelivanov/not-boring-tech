import {
  WeeklyDigestDeliveryStatus,
  WeeklyDigestLanguage,
  WeeklyDigestRunStatus,
  type DbClient,
  type DbTransaction,
} from "@findthatproject/db";

import { visibleCatalogWhere } from "../catalog/queries";
import { renderDigestMessages } from "./renderer";
import {
  TelegramPublishError,
  type TelegramDigestPublisher,
} from "./telegram-bot-client";

const MINIMUM_INTERVAL_MS = 144 * 60 * 60 * 1_000;
const MAXIMUM_INITIAL_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1_000;

export interface DigestCoordinatorConfig {
  readonly initialStartAt: Date;
  readonly siteOrigin: string;
  readonly channelEn: string;
  readonly channelRu: string;
  readonly maxAttempts: number;
}

export interface DigestCoordinatorDependencies {
  readonly database: DbClient;
  readonly publisher: TelegramDigestPublisher;
  readonly now?: () => Date;
}

export interface DigestPublishResult {
  readonly runId: string | null;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly itemCount: number;
  readonly partCounts: Readonly<Record<"EN" | "RU", number>>;
  readonly sentCounts: Readonly<Record<"EN" | "RU", number>>;
  readonly status:
    "NOOP" | "PENDING" | "PARTIAL" | "REVIEW_REQUIRED" | "SUCCEEDED";
  readonly failureClass: string | null;
}

export interface ResolveDigestDeliveryInput {
  readonly deliveryId: string;
  readonly outcome: "sent" | "unsent";
  readonly messageId?: bigint;
}

interface PreparedRun {
  readonly type: "run";
  readonly runId: string;
}

interface NoopPreparation {
  readonly type: "noop";
}

const safeDate = (date: Date, errorClass: string): Date => {
  if (!Number.isFinite(date.getTime())) throw new Error(errorClass);
  return date;
};

const prepareRun = async (
  transaction: DbTransaction,
  config: DigestCoordinatorConfig,
  now: Date,
): Promise<PreparedRun | NoopPreparation> => {
  const existing = await transaction.weeklyDigestRun.findFirst({
    where: { status: { not: WeeklyDigestRunStatus.SUCCEEDED } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (existing !== null) return { type: "run", runId: existing.id };

  const latestSuccessful = await transaction.weeklyDigestRun.findFirst({
    where: { status: WeeklyDigestRunStatus.SUCCEEDED },
    orderBy: [{ windowEnd: "desc" }, { id: "desc" }],
    select: { eligibilityStartAt: true, windowEnd: true },
  });
  if (
    latestSuccessful !== null &&
    now.getTime() - latestSuccessful.windowEnd.getTime() < MINIMUM_INTERVAL_MS
  ) {
    return { type: "noop" };
  }

  const initialStartAt = safeDate(
    config.initialStartAt,
    "DIGEST_INVALID_INITIAL_START",
  );
  const eligibilityStartAt =
    latestSuccessful?.eligibilityStartAt ?? initialStartAt;
  if (latestSuccessful === null) {
    const lookback = now.getTime() - eligibilityStartAt.getTime();
    if (lookback <= 0) throw new Error("DIGEST_INITIAL_START_NOT_PAST");
    if (lookback > MAXIMUM_INITIAL_LOOKBACK_MS) {
      throw new Error("DIGEST_INITIAL_LOOKBACK_TOO_LONG");
    }
  }
  const windowStart = latestSuccessful?.windowEnd ?? eligibilityStartAt;
  if (windowStart.getTime() >= now.getTime()) {
    throw new Error("DIGEST_INVALID_WINDOW");
  }

  const items = await transaction.catalogItem.findMany({
    where: {
      AND: [
        visibleCatalogWhere,
        { createdAt: { gt: eligibilityStartAt, lte: now } },
        { weeklyDigestItems: { none: {} } },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      nameRu: true,
      canonicalUrl: true,
      githubUrl: true,
      githubRepository: true,
      githubStars: true,
      descriptionEn: true,
      descriptionRu: true,
      createdAt: true,
    },
  });

  if (items.some((item) => item.descriptionRu === null)) {
    const run = await transaction.weeklyDigestRun.create({
      data: {
        eligibilityStartAt,
        windowStart,
        windowEnd: now,
        status: WeeklyDigestRunStatus.REVIEW_REQUIRED,
        itemCount: items.length,
        failureClass: "DIGEST_MISSING_RUSSIAN_DESCRIPTION",
      },
      select: { id: true },
    });
    return { type: "run", runId: run.id };
  }

  const snapshots = items.map((item, ordinal) => ({
    ordinal,
    slug: item.slug,
    name: item.name,
    nameRu: item.nameRu,
    canonicalUrl: item.canonicalUrl,
    githubUrl: item.githubUrl,
    githubRepository: item.githubRepository,
    githubStars: item.githubStars,
    descriptionEn: item.descriptionEn,
    descriptionRu: item.descriptionRu!,
  }));
  const renderedEn = renderDigestMessages({
    windowStart,
    windowEnd: now,
    items: snapshots,
    language: "EN",
    siteOrigin: config.siteOrigin,
  });
  const renderedRu = renderDigestMessages({
    windowStart,
    windowEnd: now,
    items: snapshots,
    language: "RU",
    siteOrigin: config.siteOrigin,
  });
  const run = await transaction.weeklyDigestRun.create({
    data: {
      eligibilityStartAt,
      windowStart,
      windowEnd: now,
      itemCount: items.length,
    },
    select: { id: true },
  });
  if (items.length > 0) {
    await transaction.weeklyDigestItem.createMany({
      data: items.map((item, ordinal) => ({
        digestRunId: run.id,
        catalogItemId: item.id,
        ordinal,
        slug: item.slug,
        name: item.name,
        nameRu: item.nameRu,
        canonicalUrl: item.canonicalUrl,
        githubUrl: item.githubUrl,
        githubRepository: item.githubRepository,
        githubStars: item.githubStars,
        descriptionEn: item.descriptionEn,
        descriptionRu: item.descriptionRu!,
        catalogCreatedAt: item.createdAt,
      })),
    });
  }
  await transaction.weeklyDigestDelivery.createMany({
    data: [
      ...renderedEn.map((message) => ({
        digestRunId: run.id,
        language: WeeklyDigestLanguage.EN,
        partIndex: message.partIndex,
        targetChatId: config.channelEn,
        renderedHtml: message.renderedHtml,
      })),
      ...renderedRu.map((message) => ({
        digestRunId: run.id,
        language: WeeklyDigestLanguage.RU,
        partIndex: message.partIndex,
        targetChatId: config.channelRu,
        renderedHtml: message.renderedHtml,
      })),
    ],
  });
  return { type: "run", runId: run.id };
};

const recomputeRunStatus = async (
  database: DbClient | DbTransaction,
  runId: string,
): Promise<void> => {
  const [run, deliveries] = await Promise.all([
    database.weeklyDigestRun.findUniqueOrThrow({
      where: { id: runId },
      select: { status: true, failureClass: true },
    }),
    database.weeklyDigestDelivery.findMany({
      where: { digestRunId: runId },
      orderBy: [{ language: "asc" }, { partIndex: "asc" }, { id: "asc" }],
      select: { status: true, failureClass: true },
    }),
  ]);
  if (deliveries.length === 0) return;

  const review = deliveries.find(
    (delivery) =>
      delivery.status === WeeklyDigestDeliveryStatus.REVIEW_REQUIRED ||
      delivery.status === WeeklyDigestDeliveryStatus.SENDING,
  );
  const failed = deliveries.find(
    (delivery) => delivery.status === WeeklyDigestDeliveryStatus.FAILED,
  );
  const allSent = deliveries.every(
    (delivery) => delivery.status === WeeklyDigestDeliveryStatus.SENT,
  );
  const anyProgress = deliveries.some(
    (delivery) =>
      delivery.status === WeeklyDigestDeliveryStatus.SENT ||
      delivery.status === WeeklyDigestDeliveryStatus.FAILED,
  );
  const status = review
    ? WeeklyDigestRunStatus.REVIEW_REQUIRED
    : allSent
      ? WeeklyDigestRunStatus.SUCCEEDED
      : anyProgress
        ? WeeklyDigestRunStatus.PARTIAL
        : WeeklyDigestRunStatus.PENDING;
  const failureClass = review?.failureClass ?? failed?.failureClass ?? null;
  if (run.status !== status || run.failureClass !== failureClass) {
    await database.weeklyDigestRun.update({
      where: { id: runId },
      data: { status, failureClass },
    });
  }
};

const aggregateRun = async (
  database: DbClient,
  runId: string,
): Promise<DigestPublishResult> => {
  const run = await database.weeklyDigestRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      deliveries: {
        select: { language: true, status: true },
      },
    },
  });
  const deliveriesFor = (language: WeeklyDigestLanguage) =>
    run.deliveries.filter((delivery) => delivery.language === language);
  return {
    runId: run.id,
    windowStart: run.windowStart.toISOString(),
    windowEnd: run.windowEnd.toISOString(),
    itemCount: run.itemCount,
    partCounts: {
      EN: deliveriesFor(WeeklyDigestLanguage.EN).length,
      RU: deliveriesFor(WeeklyDigestLanguage.RU).length,
    },
    sentCounts: {
      EN: deliveriesFor(WeeklyDigestLanguage.EN).filter(
        (delivery) => delivery.status === WeeklyDigestDeliveryStatus.SENT,
      ).length,
      RU: deliveriesFor(WeeklyDigestLanguage.RU).filter(
        (delivery) => delivery.status === WeeklyDigestDeliveryStatus.SENT,
      ).length,
    },
    status: run.status,
    failureClass: run.failureClass,
  };
};

export const publishWeeklyDigest = async (
  config: DigestCoordinatorConfig,
  dependencies: DigestCoordinatorDependencies,
): Promise<DigestPublishResult> => {
  const now = safeDate(
    (dependencies.now ?? (() => new Date()))(),
    "DIGEST_INVALID_CLOCK",
  );
  const preparation = await dependencies.database.$transaction((transaction) =>
    prepareRun(transaction, config, now),
  );
  if (preparation.type === "noop") {
    return {
      runId: null,
      windowStart: null,
      windowEnd: null,
      itemCount: 0,
      partCounts: { EN: 0, RU: 0 },
      sentCounts: { EN: 0, RU: 0 },
      status: "NOOP",
      failureClass: null,
    };
  }
  const runId = preparation.runId;
  const inheritedSending =
    await dependencies.database.weeklyDigestDelivery.updateMany({
      where: {
        digestRunId: runId,
        status: WeeklyDigestDeliveryStatus.SENDING,
      },
      data: {
        status: WeeklyDigestDeliveryStatus.REVIEW_REQUIRED,
        failureClass: "TELEGRAM_AMBIGUOUS_PREVIOUS_SEND",
      },
    });
  if (inheritedSending.count > 0) {
    await recomputeRunStatus(dependencies.database, runId);
    return aggregateRun(dependencies.database, runId);
  }

  const reviewCount = await dependencies.database.weeklyDigestDelivery.count({
    where: {
      digestRunId: runId,
      status: WeeklyDigestDeliveryStatus.REVIEW_REQUIRED,
    },
  });
  if (reviewCount > 0) {
    await recomputeRunStatus(dependencies.database, runId);
    return aggregateRun(dependencies.database, runId);
  }

  const deliveries = await dependencies.database.weeklyDigestDelivery.findMany({
    where: {
      digestRunId: runId,
      status: {
        in: [
          WeeklyDigestDeliveryStatus.PENDING,
          WeeklyDigestDeliveryStatus.FAILED,
        ],
      },
    },
    orderBy: [{ language: "asc" }, { partIndex: "asc" }, { id: "asc" }],
  });
  const blockedLanguages = new Set<WeeklyDigestLanguage>();
  for (const delivery of deliveries) {
    if (blockedLanguages.has(delivery.language)) continue;
    if (
      delivery.status === WeeklyDigestDeliveryStatus.FAILED &&
      delivery.attemptCount >= config.maxAttempts
    ) {
      blockedLanguages.add(delivery.language);
      continue;
    }
    const transition =
      await dependencies.database.weeklyDigestDelivery.updateMany({
        where: {
          id: delivery.id,
          OR: [
            { status: WeeklyDigestDeliveryStatus.PENDING },
            {
              status: WeeklyDigestDeliveryStatus.FAILED,
              attemptCount: { lt: config.maxAttempts },
            },
          ],
        },
        data: {
          status: WeeklyDigestDeliveryStatus.SENDING,
          attemptCount: { increment: 1 },
          lastAttemptedAt: now,
          failureClass: null,
        },
      });
    if (transition.count !== 1) continue;

    try {
      const sent = await dependencies.publisher.sendMessage({
        chatId: delivery.targetChatId,
        html: delivery.renderedHtml,
      });
      await dependencies.database.weeklyDigestDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WeeklyDigestDeliveryStatus.SENT,
          attemptCount: { increment: Math.max(sent.attempts - 1, 0) },
          telegramMessageId: sent.messageId,
          sentAt: now,
          failureClass: null,
        },
      });
    } catch (error) {
      const publishError =
        error instanceof TelegramPublishError
          ? error
          : new TelegramPublishError("TELEGRAM_AMBIGUOUS", true, 1);
      await dependencies.database.weeklyDigestDelivery.update({
        where: { id: delivery.id },
        data: {
          status: publishError.ambiguous
            ? WeeklyDigestDeliveryStatus.REVIEW_REQUIRED
            : WeeklyDigestDeliveryStatus.FAILED,
          attemptCount: { increment: Math.max(publishError.attempts - 1, 0) },
          failureClass: publishError.errorClass,
        },
      });
      blockedLanguages.add(delivery.language);
    }
    await recomputeRunStatus(dependencies.database, runId);
  }

  await recomputeRunStatus(dependencies.database, runId);
  return aggregateRun(dependencies.database, runId);
};

export const resolveDigestDelivery = async (
  database: DbClient,
  input: ResolveDigestDeliveryInput,
  now: Date = new Date(),
): Promise<DigestPublishResult> => {
  safeDate(now, "DIGEST_INVALID_CLOCK");
  if (
    input.outcome === "sent" &&
    (input.messageId === undefined || input.messageId <= 0n)
  ) {
    throw new Error("DIGEST_INVALID_MESSAGE_ID");
  }
  const delivery = await database.weeklyDigestDelivery.findUnique({
    where: { id: input.deliveryId },
    select: { digestRunId: true, status: true },
  });
  if (
    delivery === null ||
    (delivery.status !== WeeklyDigestDeliveryStatus.SENDING &&
      delivery.status !== WeeklyDigestDeliveryStatus.REVIEW_REQUIRED)
  ) {
    throw new Error("DIGEST_DELIVERY_NOT_RESOLVABLE");
  }

  await database.weeklyDigestDelivery.update({
    where: { id: input.deliveryId },
    data:
      input.outcome === "sent"
        ? {
            status: WeeklyDigestDeliveryStatus.SENT,
            telegramMessageId: input.messageId!,
            sentAt: now,
            resolvedAt: now,
            failureClass: null,
          }
        : {
            status: WeeklyDigestDeliveryStatus.PENDING,
            telegramMessageId: null,
            sentAt: null,
            resolvedAt: now,
            failureClass: null,
          },
  });
  await recomputeRunStatus(database, delivery.digestRunId);
  return aggregateRun(database, delivery.digestRunId);
};
