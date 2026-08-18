import {
  catalogCategorySchema,
  type CatalogCategory,
} from "@findthatproject/contracts";
import {
  AnalyzedPostStatus,
  type DbClient,
  type DbTransaction,
} from "@findthatproject/db";

import {
  deriveCatalogIdentity,
  normalizeIdentityText,
  normalizeTag,
} from "./identity";

const DEFAULT_BACKFILL_LIMIT = 500;
const BACKFILL_BATCH_SIZE = 100;

const uniqueStrings = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const searchTextFor = (input: {
  readonly name: string;
  readonly parentName: string | null;
  readonly descriptionEn: string;
  readonly tags: readonly string[];
  readonly canonicalUrl: string | null;
}): string =>
  [
    input.name,
    input.parentName,
    input.descriptionEn,
    ...input.tags,
    input.canonicalUrl,
  ]
    .filter((value): value is string => value !== null)
    .join(" ")
    .normalize("NFKC")
    .toLocaleLowerCase("en");

const allocateSlug = async (
  transaction: DbTransaction,
  slugBase: string,
  slugSuffix: string,
): Promise<string> => {
  const candidates = [
    slugBase,
    `${slugBase}-${slugSuffix.slice(0, 8)}`,
    `${slugBase}-${slugSuffix}`,
  ];
  for (const candidate of candidates) {
    const existing = await transaction.catalogItem.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (existing === null) return candidate;
  }
  throw new Error("CATALOG_SLUG_COLLISION");
};

const consolidateCatalogItems = async (
  transaction: DbTransaction,
  catalogItemIds: readonly string[],
): Promise<string | null> => {
  const items = await transaction.catalogItem.findMany({
    where: { id: { in: [...uniqueStrings(catalogItemIds)] } },
    select: { id: true, slug: true },
  });
  if (items.length === 0) return null;

  items.sort(
    (left, right) =>
      left.slug.length - right.slug.length ||
      left.slug.localeCompare(right.slug) ||
      left.id.localeCompare(right.id),
  );
  const survivor = items[0]!;
  const duplicateIds = items.slice(1).map((item) => item.id);
  if (duplicateIds.length === 0) return survivor.id;

  await transaction.presentationCandidate.updateMany({
    where: { catalogItemId: { in: duplicateIds } },
    data: { catalogItemId: survivor.id },
  });
  await transaction.catalogIdentityAlias.updateMany({
    where: { catalogItemId: { in: duplicateIds } },
    data: { catalogItemId: survivor.id },
  });
  await transaction.catalogItem.deleteMany({
    where: { id: { in: duplicateIds } },
  });
  return survivor.id;
};

const visibleCandidatesForItem = (
  transaction: DbTransaction,
  catalogItemId: string,
) =>
  transaction.presentationCandidate.findMany({
    where: {
      catalogItemId,
      analyzedPost: {
        status: AnalyzedPostStatus.PRESENTATIONS_SAVED,
        channel: { enabled: true },
      },
    },
    select: {
      id: true,
      kind: true,
      category: true,
      name: true,
      parentName: true,
      subjectUrl: true,
      githubUrl: true,
      descriptionEn: true,
      descriptionRu: true,
      tags: true,
      confidence: true,
      analyzedPost: { select: { publishedAt: true } },
    },
  });

export const refreshCatalogItems = async (
  transaction: DbTransaction,
  catalogItemIds: readonly string[],
): Promise<void> => {
  for (const catalogItemId of uniqueStrings(catalogItemIds)) {
    const candidates = await visibleCandidatesForItem(
      transaction,
      catalogItemId,
    );
    if (candidates.length === 0) continue;

    candidates.sort((left, right) => {
      const confidenceDifference =
        Number(right.confidence) - Number(left.confidence);
      if (confidenceDifference !== 0) return confidenceDifference;
      const publishedDifference =
        right.analyzedPost.publishedAt.getTime() -
        left.analyzedPost.publishedAt.getTime();
      return publishedDifference || left.id.localeCompare(right.id);
    });
    const winner = candidates[0]!;
    const category: CatalogCategory = catalogCategorySchema.parse(
      winner.category,
    );
    const identity = deriveCatalogIdentity(winner);
    const tags = uniqueStrings(
      candidates.flatMap((candidate) => candidate.tags.map(normalizeTag)),
    ).filter(Boolean);
    const timestamps = candidates.map((candidate) =>
      candidate.analyzedPost.publishedAt.getTime(),
    );
    const canonicalUrl = identity.canonicalUrl;
    const githubUrl =
      candidates.find((candidate) => candidate.githubUrl !== null)?.githubUrl ??
      null;

    await transaction.catalogItem.update({
      where: { id: catalogItemId },
      data: {
        kind: winner.kind,
        category,
        name: winner.name,
        nameSortKey: normalizeIdentityText(winner.name),
        parentName: winner.parentName,
        canonicalUrl,
        githubUrl,
        descriptionEn: winner.descriptionEn,
        descriptionRu: winner.descriptionRu,
        tags: [...tags],
        searchText: searchTextFor({
          name: winner.name,
          parentName: winner.parentName,
          descriptionEn: winner.descriptionEn,
          tags,
          canonicalUrl,
        }),
        firstMentionedAt: new Date(Math.min(...timestamps)),
        lastMentionedAt: new Date(Math.max(...timestamps)),
      },
    });
  }
};

export const projectCandidateIds = async (
  transaction: DbTransaction,
  candidateIds: readonly string[],
): Promise<readonly string[]> => {
  const affectedItemIds: string[] = [];
  const candidates = await transaction.presentationCandidate.findMany({
    where: { id: { in: [...candidateIds] } },
    include: { analyzedPost: { select: { publishedAt: true } } },
  });
  candidates.sort((left, right) => {
    const confidenceDifference =
      Number(right.confidence) - Number(left.confidence);
    if (confidenceDifference !== 0) return confidenceDifference;
    const publishedDifference =
      right.analyzedPost.publishedAt.getTime() -
      left.analyzedPost.publishedAt.getTime();
    return publishedDifference || left.id.localeCompare(right.id);
  });

  for (const candidate of candidates) {
    const identity = deriveCatalogIdentity(candidate);
    const [currentCandidate, matchingAliases, matchingLegacyItem] =
      await Promise.all([
        transaction.presentationCandidate.findUniqueOrThrow({
          where: { id: candidate.id },
          select: { catalogItemId: true },
        }),
        transaction.catalogIdentityAlias.findMany({
          where: { identityKey: { in: [...identity.identityKeys] } },
          select: { catalogItemId: true },
        }),
        transaction.catalogItem.findUnique({
          where: { identityKey: identity.identityKey },
          select: { id: true },
        }),
      ]);
    const matchingItemIds = [
      ...matchingAliases.map((alias) => alias.catalogItemId),
      ...(matchingLegacyItem === null ? [] : [matchingLegacyItem.id]),
      ...(currentCandidate.catalogItemId === null
        ? []
        : [currentCandidate.catalogItemId]),
    ];
    let itemId = await consolidateCatalogItems(transaction, matchingItemIds);
    if (itemId === null) {
      const category = catalogCategorySchema.parse(candidate.category);
      const tags = uniqueStrings(candidate.tags.map(normalizeTag)).filter(
        Boolean,
      );
      const slug = await allocateSlug(
        transaction,
        identity.slugBase,
        identity.slugSuffix,
      );
      const item = await transaction.catalogItem.create({
        data: {
          identityKey: identity.identityKey,
          slug,
          kind: candidate.kind,
          category,
          name: candidate.name,
          nameSortKey: identity.nameSortKey,
          parentName: candidate.parentName,
          canonicalUrl: identity.canonicalUrl,
          githubUrl: candidate.githubUrl,
          descriptionEn: candidate.descriptionEn,
          descriptionRu: candidate.descriptionRu,
          tags: [...tags],
          searchText: searchTextFor({
            name: candidate.name,
            parentName: candidate.parentName,
            descriptionEn: candidate.descriptionEn,
            tags,
            canonicalUrl: identity.canonicalUrl,
          }),
          firstMentionedAt: candidate.analyzedPost.publishedAt,
          lastMentionedAt: candidate.analyzedPost.publishedAt,
        },
        select: { id: true },
      });
      itemId = item.id;
    }

    await transaction.catalogIdentityAlias.createMany({
      data: identity.identityKeys.map((identityKey) => ({
        identityKey,
        catalogItemId: itemId,
      })),
      skipDuplicates: true,
    });

    await transaction.presentationCandidate.update({
      where: { id: candidate.id },
      data: { catalogItemId: itemId },
    });
    affectedItemIds.push(itemId);
  }

  await refreshCatalogItems(transaction, affectedItemIds);
  return uniqueStrings(affectedItemIds);
};

export const reconcileCatalogProjection = async (
  database: DbClient,
): Promise<number> => {
  let reconciled = 0;
  let cursor: string | null = null;
  while (true) {
    const candidates: Array<{ readonly id: string }> =
      await database.presentationCandidate.findMany({
        where: {
          analyzedPost: { status: AnalyzedPostStatus.PRESENTATIONS_SAVED },
        },
        select: { id: true },
        orderBy: { id: "asc" },
        take: BACKFILL_BATCH_SIZE,
        ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
      });
    if (candidates.length === 0) break;
    await database.$transaction((transaction) =>
      projectCandidateIds(
        transaction,
        candidates.map((candidate) => candidate.id),
      ),
    );
    reconciled += candidates.length;
    cursor = candidates.at(-1)!.id;
  }
  return reconciled;
};

export const backfillCatalogProjection = async (
  database: DbClient,
  maximumCandidates = DEFAULT_BACKFILL_LIMIT,
): Promise<number> => {
  let projected = 0;
  while (projected < maximumCandidates) {
    const candidates = await database.presentationCandidate.findMany({
      where: {
        catalogItemId: null,
        analyzedPost: { status: AnalyzedPostStatus.PRESENTATIONS_SAVED },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: Math.min(BACKFILL_BATCH_SIZE, maximumCandidates - projected),
    });
    if (candidates.length === 0) break;
    await database.$transaction((transaction) =>
      projectCandidateIds(
        transaction,
        candidates.map((candidate) => candidate.id),
      ),
    );
    projected += candidates.length;
  }
  return projected;
};
