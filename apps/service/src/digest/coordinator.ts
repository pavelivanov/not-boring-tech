import {
  AnalyzedPostStatus,
  WeeklyDigestDeliveryKind,
  WeeklyDigestDeliveryStatus,
  WeeklyDigestLanguage,
  WeeklyDigestRunStatus,
  type DbClient,
  type DbTransaction,
} from "@findthatproject/db";
import { technologyKindSchema } from "@findthatproject/contracts";

import { refreshCatalogItems } from "../catalog/projector";
import { visibleCandidateWhere, visibleCatalogWhere } from "../catalog/queries";
import { rankDigestItems } from "./ranking";
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
  readonly maxItems: number;
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
  readonly selectedCount: number | null;
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
    select: {
      id: true,
      eligibilityStartAt: true,
      windowStart: true,
      windowEnd: true,
      status: true,
      failureClass: true,
      _count: { select: { items: true, deliveries: true } },
    },
  });
  const recoverableRun =
    existing !== null &&
    existing.status === WeeklyDigestRunStatus.REVIEW_REQUIRED &&
    existing.failureClass === "DIGEST_MISSING_RUSSIAN_DESCRIPTION" &&
    existing._count.items === 0 &&
    existing._count.deliveries === 0
      ? existing
      : null;
  if (existing !== null && recoverableRun === null) {
    return { type: "run", runId: existing.id };
  }

  let eligibilityStartAt: Date;
  let windowStart: Date;
  let windowEnd: Date;
  if (recoverableRun !== null) {
    eligibilityStartAt = recoverableRun.eligibilityStartAt;
    windowStart = recoverableRun.windowStart;
    windowEnd = recoverableRun.windowEnd;
  } else {
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
    eligibilityStartAt = latestSuccessful?.eligibilityStartAt ?? initialStartAt;
    if (latestSuccessful === null) {
      const lookback = now.getTime() - eligibilityStartAt.getTime();
      if (lookback <= 0) throw new Error("DIGEST_INITIAL_START_NOT_PAST");
      if (lookback > MAXIMUM_INITIAL_LOOKBACK_MS) {
        throw new Error("DIGEST_INITIAL_LOOKBACK_TOO_LONG");
      }
    }
    windowStart = latestSuccessful?.windowEnd ?? eligibilityStartAt;
    windowEnd = now;
    if (windowStart.getTime() >= windowEnd.getTime()) {
      throw new Error("DIGEST_INVALID_WINDOW");
    }
  }

  const eligibleWhere = {
    AND: [
      visibleCatalogWhere,
      { createdAt: { gt: eligibilityStartAt, lte: windowEnd } },
      { weeklyDigestItems: { none: {} } },
    ],
  };
  const eligibleItemIds = await transaction.catalogItem.findMany({
    where: eligibleWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (eligibleItemIds.length > 0) {
    await refreshCatalogItems(
      transaction,
      eligibleItemIds.map((item) => item.id),
    );
  }

  const items = await transaction.catalogItem.findMany({
    where: eligibleWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      slug: true,
      kind: true,
      name: true,
      nameRu: true,
      canonicalUrl: true,
      githubUrl: true,
      githubRepository: true,
      githubStars: true,
      descriptionEn: true,
      descriptionRu: true,
      createdAt: true,
      lastMentionedAt: true,
    },
  });

  if (items.some((item) => item.descriptionRu === null)) {
    if (recoverableRun !== null) {
      await transaction.weeklyDigestRun.update({
        where: { id: recoverableRun.id },
        data: { itemCount: items.length },
      });
      return { type: "run", runId: recoverableRun.id };
    }
    const run = await transaction.weeklyDigestRun.create({
      data: {
        eligibilityStartAt,
        windowStart,
        windowEnd,
        status: WeeklyDigestRunStatus.REVIEW_REQUIRED,
        itemCount: items.length,
        failureClass: "DIGEST_MISSING_RUSSIAN_DESCRIPTION",
      },
      select: { id: true },
    });
    return { type: "run", runId: run.id };
  }

  const mentionRows =
    items.length > 0
      ? await transaction.presentationCandidate.findMany({
          where: {
            catalogItemId: { in: items.map((item) => item.id) },
            analyzedPost: {
              ...visibleCandidateWhere.analyzedPost,
              publishedAt: { gt: eligibilityStartAt },
            },
          },
          select: {
            catalogItemId: true,
            analyzedPost: { select: { channelId: true } },
          },
        })
      : [];
  const mentionStats = new Map<
    string,
    { mentionCount: number; channels: Set<string> }
  >();
  for (const row of mentionRows) {
    if (row.catalogItemId === null) continue;
    const stats = mentionStats.get(row.catalogItemId) ?? {
      mentionCount: 0,
      channels: new Set<string>(),
    };
    stats.mentionCount += 1;
    stats.channels.add(row.analyzedPost.channelId);
    mentionStats.set(row.catalogItemId, stats);
  }
  const ranking = rankDigestItems(
    items.map((item) => {
      const stats = mentionStats.get(item.id);
      return {
        id: item.id,
        kind: technologyKindSchema.parse(item.kind),
        githubStars: item.githubStars,
        lastMentionedAt: item.lastMentionedAt,
        mentionCount: stats?.mentionCount ?? 0,
        channelCount: stats?.channels.size ?? 0,
      };
    }),
    config.maxItems,
  );
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const orderedItems = [...ranking.selected, ...ranking.overflow]
    .map((ranked) => itemsById.get(ranked.id)!)
    .map((item) => ({
      ...item,
      kind: technologyKindSchema.parse(item.kind),
    }));

  const snapshotFor = (
    item: (typeof orderedItems)[number],
    ordinal: number,
  ) => ({
    ordinal,
    slug: item.slug,
    kind: item.kind,
    name: item.name,
    nameRu: item.nameRu,
    canonicalUrl: item.canonicalUrl,
    githubUrl: item.githubUrl,
    githubRepository: item.githubRepository,
    githubStars: item.githubStars,
    descriptionEn: item.descriptionEn,
    descriptionRu: item.descriptionRu!,
  });
  const selectedSnapshots = orderedItems
    .slice(0, ranking.selected.length)
    .map(snapshotFor);
  const overflowCount = items.length - ranking.selected.length;
  const renderedEn = renderDigestMessages({
    windowStart,
    windowEnd,
    items: selectedSnapshots,
    overflowCount,
    language: "EN",
    siteOrigin: config.siteOrigin,
  });
  const renderedRu = renderDigestMessages({
    windowStart,
    windowEnd,
    items: selectedSnapshots,
    overflowCount,
    language: "RU",
    siteOrigin: config.siteOrigin,
  });
  const run =
    recoverableRun === null
      ? await transaction.weeklyDigestRun.create({
          data: {
            eligibilityStartAt,
            windowStart,
            windowEnd,
            itemCount: items.length,
            selectedCount: ranking.selected.length,
          },
          select: { id: true },
        })
      : await transaction.weeklyDigestRun.update({
          where: { id: recoverableRun.id },
          data: {
            status: WeeklyDigestRunStatus.PENDING,
            failureClass: null,
            itemCount: items.length,
            selectedCount: ranking.selected.length,
          },
          select: { id: true },
        });
  if (items.length > 0) {
    await transaction.weeklyDigestItem.createMany({
      data: orderedItems.map((item, ordinal) => ({
        digestRunId: run.id,
        catalogItemId: item.id,
        ordinal,
        slug: item.slug,
        kind: item.kind,
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
        kind: WeeklyDigestDeliveryKind.TEXT,
        partIndex: message.partIndex,
        targetChatId: config.channelEn,
        renderedHtml: message.renderedHtml,
      })),
      ...renderedRu.map((message) => ({
        digestRunId: run.id,
        language: WeeklyDigestLanguage.RU,
        kind: WeeklyDigestDeliveryKind.TEXT,
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
        select: { language: true, kind: true, status: true },
      },
    },
  });
  const deliveriesFor = (language: WeeklyDigestLanguage) =>
    run.deliveries.filter(
      (delivery) =>
        delivery.language === language &&
        delivery.kind === WeeklyDigestDeliveryKind.TEXT,
    );
  return {
    runId: run.id,
    windowStart: run.windowStart.toISOString(),
    windowEnd: run.windowEnd.toISOString(),
    itemCount: run.itemCount,
    selectedCount: run.selectedCount,
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
      selectedCount: null,
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
      const sent =
        delivery.kind === WeeklyDigestDeliveryKind.PHOTO
          ? await dependencies.publisher.sendPhoto({
              chatId: delivery.targetChatId,
              photoUrl: delivery.mediaUrl!,
            })
          : await dependencies.publisher.sendMessage({
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
