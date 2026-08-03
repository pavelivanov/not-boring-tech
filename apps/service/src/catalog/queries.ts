import {
  CATALOG_CATEGORIES,
  CATALOG_SORTS,
  TECHNOLOGY_KINDS,
  catalogChannelsResponseSchema,
  catalogDetailResponseSchema,
  catalogFacetsResponseSchema,
  catalogListResponseSchema,
  type CatalogActiveFilters,
  type CatalogCategory,
  type CatalogChannelsResponse,
  type CatalogDetailResponse,
  type CatalogFacetsResponse,
  type CatalogListResponse,
  type CatalogSort,
  type TechnologyKind,
} from "@techdex/contracts";
import { AnalyzedPostStatus, type DbClient, type Prisma } from "@techdex/db";
import { z } from "zod";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const QUERY_KEYS = new Set([
  "q",
  "kind",
  "category",
  "channel",
  "tag",
  "sort",
  "cursor",
  "limit",
]);
const HANDLE_PATTERN = /^@[a-z][a-z0-9_]{4,31}$/i;

const cursorSchema = z
  .object({
    version: z.literal(1),
    sort: z.enum(CATALOG_SORTS),
    slug: z.string().min(1).max(160),
  })
  .strict();

export class CatalogQueryError extends Error {
  constructor() {
    super("INVALID_CATALOG_QUERY");
    this.name = "CatalogQueryError";
  }
}

const unique = <Value>(values: readonly Value[]): Value[] => [
  ...new Set(values),
];

const normalizedSearchText = (value: string): string =>
  value.normalize("NFKC").toLocaleLowerCase("en").trim().replace(/\s+/gu, " ");

const parseControlledValues = <Value extends string>(
  values: readonly string[],
  allowedValues: readonly Value[],
  maximum: number,
): Value[] => {
  const allowed = new Set<string>(allowedValues);
  const parsed = unique(values.map((value) => value.trim()).filter(Boolean));
  if (parsed.length > maximum || parsed.some((value) => !allowed.has(value))) {
    throw new CatalogQueryError();
  }
  return parsed as Value[];
};

export interface ParsedCatalogQuery {
  readonly filters: CatalogActiveFilters;
  readonly cursor: string | null;
}

export const parseCatalogQuery = (
  query: Readonly<Record<string, readonly string[]>>,
): ParsedCatalogQuery => {
  if (Object.keys(query).some((key) => !QUERY_KEYS.has(key))) {
    throw new CatalogQueryError();
  }
  const single = (key: string): string | undefined => {
    const values = query[key] ?? [];
    if (values.length > 1) throw new CatalogQueryError();
    return values[0];
  };
  const q = normalizedSearchText(single("q") ?? "");
  if (q.length > 200) throw new CatalogQueryError();
  const kind = parseControlledValues(
    query.kind ?? [],
    TECHNOLOGY_KINDS,
    TECHNOLOGY_KINDS.length,
  );
  const category = parseControlledValues(
    query.category ?? [],
    CATALOG_CATEGORIES,
    CATALOG_CATEGORIES.length,
  );
  const channel = unique(
    (query.channel ?? []).map((handle) =>
      handle.trim().toLocaleLowerCase("en"),
    ),
  );
  if (
    channel.length > 10 ||
    channel.some((handle) => !HANDLE_PATTERN.test(handle))
  ) {
    throw new CatalogQueryError();
  }
  const tag = unique(
    (query.tag ?? []).map(normalizedSearchText).filter(Boolean),
  );
  if (tag.length > 20 || tag.some((value) => value.length > 48)) {
    throw new CatalogQueryError();
  }
  const sortValue = single("sort") ?? "latest";
  if (!CATALOG_SORTS.includes(sortValue as CatalogSort)) {
    throw new CatalogQueryError();
  }
  const limitValue = single("limit");
  const limit = limitValue === undefined ? DEFAULT_LIMIT : Number(limitValue);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new CatalogQueryError();
  }
  const cursor = single("cursor") ?? null;
  if (cursor !== null && (cursor.length < 1 || cursor.length > 2_048)) {
    throw new CatalogQueryError();
  }

  return {
    filters: {
      q,
      kind,
      category,
      channel,
      tag,
      sort: sortValue as CatalogSort,
      limit,
    },
    cursor,
  };
};

const visibleCandidateWhere = {
  analyzedPost: {
    status: AnalyzedPostStatus.PRESENTATIONS_SAVED,
    channel: { enabled: true },
  },
} satisfies Prisma.PresentationCandidateWhereInput;

export const visibleCatalogWhere = {
  presentations: { some: visibleCandidateWhere },
} satisfies Prisma.CatalogItemWhereInput;

const encodeCursor = (sort: CatalogSort, slug: string): string =>
  Buffer.from(JSON.stringify({ version: 1, sort, slug }), "utf8").toString(
    "base64url",
  );

const decodeCursor = (
  value: string,
  expectedSort: CatalogSort,
): z.infer<typeof cursorSchema> => {
  try {
    const parsed = cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    if (parsed.sort !== expectedSort) throw new CatalogQueryError();
    return parsed;
  } catch (error) {
    if (error instanceof CatalogQueryError) throw error;
    throw new CatalogQueryError();
  }
};

const cursorWhere = async (
  database: DbClient,
  cursor: string | null,
  sort: CatalogSort,
  activeConditions: readonly Prisma.CatalogItemWhereInput[],
): Promise<Prisma.CatalogItemWhereInput | null> => {
  if (cursor === null) return null;
  const decoded = decodeCursor(cursor, sort);
  const item = await database.catalogItem.findFirst({
    where: { AND: [...activeConditions, { slug: decoded.slug }] },
    select: { id: true, nameSortKey: true, lastMentionedAt: true },
  });
  if (item === null) throw new CatalogQueryError();

  return sort === "latest"
    ? {
        OR: [
          { lastMentionedAt: { lt: item.lastMentionedAt } },
          { lastMentionedAt: item.lastMentionedAt, id: { gt: item.id } },
        ],
      }
    : {
        OR: [
          { nameSortKey: { gt: item.nameSortKey } },
          { nameSortKey: item.nameSortKey, id: { gt: item.id } },
        ],
      };
};

export const listCatalog = async (
  database: DbClient,
  parsedQuery: ParsedCatalogQuery,
): Promise<CatalogListResponse> => {
  const { filters } = parsedQuery;
  const conditions: Prisma.CatalogItemWhereInput[] = [visibleCatalogWhere];
  if (filters.q) conditions.push({ searchText: { contains: filters.q } });
  if (filters.kind.length > 0) {
    conditions.push({ kind: { in: [...filters.kind] } });
  }
  if (filters.category.length > 0) {
    conditions.push({ category: { in: [...filters.category] } });
  }
  if (filters.tag.length > 0) {
    conditions.push({ tags: { hasSome: [...filters.tag] } });
  }
  if (filters.channel.length > 0) {
    conditions.push({
      presentations: {
        some: {
          ...visibleCandidateWhere,
          analyzedPost: {
            ...visibleCandidateWhere.analyzedPost,
            channel: {
              enabled: true,
              handle: { in: [...filters.channel] },
            },
          },
        },
      },
    });
  }
  const pagination = await cursorWhere(
    database,
    parsedQuery.cursor,
    filters.sort,
    conditions,
  );
  if (pagination !== null) conditions.push(pagination);

  const rows = await database.catalogItem.findMany({
    where: { AND: conditions },
    orderBy:
      filters.sort === "latest"
        ? [{ lastMentionedAt: "desc" }, { id: "asc" }]
        : [{ nameSortKey: "asc" }, { id: "asc" }],
    take: filters.limit + 1,
    select: {
      slug: true,
      name: true,
      kind: true,
      category: true,
      parentName: true,
      canonicalUrl: true,
      descriptionEn: true,
      tags: true,
      firstMentionedAt: true,
      lastMentionedAt: true,
      presentations: {
        where: visibleCandidateWhere,
        select: {
          analyzedPost: { select: { channel: { select: { handle: true } } } },
        },
      },
    },
  });
  const hasNextPage = rows.length > filters.limit;
  const page = rows.slice(0, filters.limit);
  const items = page.map((row) => ({
    slug: row.slug,
    name: row.name,
    kind: row.kind as TechnologyKind,
    category: row.category as CatalogCategory,
    parentName: row.parentName,
    canonicalUrl: row.canonicalUrl,
    descriptionEn: row.descriptionEn,
    tags: row.tags,
    firstMentionedAt: row.firstMentionedAt.toISOString(),
    lastMentionedAt: row.lastMentionedAt.toISOString(),
    mentionCount: row.presentations.length,
    channelCount: new Set(
      row.presentations.map(
        (candidate) => candidate.analyzedPost.channel.handle,
      ),
    ).size,
  }));

  return catalogListResponseSchema.parse({
    items,
    nextCursor:
      hasNextPage && page.length > 0
        ? encodeCursor(filters.sort, page.at(-1)!.slug)
        : null,
    filters,
  });
};

export const getCatalogDetail = async (
  database: DbClient,
  slug: string,
): Promise<CatalogDetailResponse | null> => {
  const row = await database.catalogItem.findFirst({
    where: { ...visibleCatalogWhere, slug },
    select: {
      slug: true,
      name: true,
      kind: true,
      category: true,
      parentName: true,
      canonicalUrl: true,
      descriptionEn: true,
      tags: true,
      firstMentionedAt: true,
      lastMentionedAt: true,
      presentations: {
        where: visibleCandidateWhere,
        orderBy: [{ analyzedPost: { publishedAt: "desc" } }, { id: "asc" }],
        select: {
          confidence: true,
          analyzedPost: {
            select: {
              sourceUrl: true,
              publishedAt: true,
              channel: {
                select: { handle: true, title: true, publicUrl: true },
              },
            },
          },
        },
      },
    },
  });
  if (row === null) return null;
  const mentions = row.presentations.map((candidate) => ({
    channelHandle: candidate.analyzedPost.channel.handle,
    channelTitle: candidate.analyzedPost.channel.title,
    channelPublicUrl: candidate.analyzedPost.channel.publicUrl,
    sourceUrl: candidate.analyzedPost.sourceUrl,
    publishedAt: candidate.analyzedPost.publishedAt.toISOString(),
    confidence: Number(candidate.confidence),
  }));

  return catalogDetailResponseSchema.parse({
    item: {
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      category: row.category,
      parentName: row.parentName,
      canonicalUrl: row.canonicalUrl,
      descriptionEn: row.descriptionEn,
      tags: row.tags,
      firstMentionedAt: row.firstMentionedAt.toISOString(),
      lastMentionedAt: row.lastMentionedAt.toISOString(),
      mentionCount: mentions.length,
      channelCount: new Set(mentions.map((mention) => mention.channelHandle))
        .size,
      mentions,
    },
  });
};

export const getCatalogFacets = async (
  database: DbClient,
): Promise<CatalogFacetsResponse> => {
  const rows = await database.catalogItem.findMany({
    where: visibleCatalogWhere,
    select: {
      kind: true,
      category: true,
      tags: true,
      presentations: {
        where: visibleCandidateWhere,
        select: {
          analyzedPost: {
            select: { channel: { select: { handle: true, title: true } } },
          },
        },
      },
    },
  });
  const categories = new Map<string, number>();
  const kinds = new Map<string, number>();
  const channels = new Map<string, { label: string; count: number }>();
  const tags = new Map<string, number>();
  for (const row of rows) {
    categories.set(row.category, (categories.get(row.category) ?? 0) + 1);
    kinds.set(row.kind, (kinds.get(row.kind) ?? 0) + 1);
    for (const tag of row.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    const itemChannels = new Map<string, string>();
    for (const candidate of row.presentations) {
      const { channel } = candidate.analyzedPost;
      itemChannels.set(channel.handle, channel.title ?? channel.handle);
    }
    for (const [handle, label] of itemChannels) {
      const current = channels.get(handle);
      channels.set(handle, { label, count: (current?.count ?? 0) + 1 });
    }
  }
  const byValue = (
    [left]: readonly [string, unknown],
    [right]: readonly [string, unknown],
  ) => left.localeCompare(right);

  return catalogFacetsResponseSchema.parse({
    categories: [...categories]
      .sort(byValue)
      .map(([value, count]) => ({ value, count })),
    kinds: [...kinds].sort(byValue).map(([value, count]) => ({ value, count })),
    channels: [...channels].sort(byValue).map(([value, data]) => ({
      value,
      label: data.label,
      count: data.count,
    })),
    tags: [...tags].sort(byValue).map(([value, count]) => ({ value, count })),
  });
};

export const getCatalogChannels = async (
  database: DbClient,
): Promise<CatalogChannelsResponse> => {
  const channels = await database.channel.findMany({
    where: {
      enabled: true,
      analyzedPosts: {
        some: {
          status: AnalyzedPostStatus.PRESENTATIONS_SAVED,
          presentations: { some: { catalogItemId: { not: null } } },
        },
      },
    },
    orderBy: { handle: "asc" },
    select: {
      handle: true,
      title: true,
      publicUrl: true,
      analyzedPosts: {
        where: { status: AnalyzedPostStatus.PRESENTATIONS_SAVED },
        select: {
          publishedAt: true,
          presentations: {
            where: { catalogItem: visibleCatalogWhere },
            select: { catalogItemId: true },
          },
        },
      },
    },
  });

  return catalogChannelsResponseSchema.parse({
    channels: channels.map((channel) => {
      const visibleMentions = channel.analyzedPosts.flatMap((post) =>
        post.presentations.map((presentation) => ({
          catalogItemId: presentation.catalogItemId,
          publishedAt: post.publishedAt,
        })),
      );
      const timestamps = visibleMentions.map((mention) =>
        mention.publishedAt.getTime(),
      );
      return {
        handle: channel.handle,
        title: channel.title,
        publicUrl: channel.publicUrl,
        itemCount: new Set(
          visibleMentions.map((mention) => mention.catalogItemId),
        ).size,
        mentionCount: visibleMentions.length,
        latestMentionedAt:
          timestamps.length === 0
            ? null
            : new Date(Math.max(...timestamps)).toISOString(),
      };
    }),
  });
};
