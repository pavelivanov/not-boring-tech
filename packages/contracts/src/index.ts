import { z } from "zod";

export const TECHNOLOGY_KINDS = [
  "PROJECT",
  "TOOL",
  "LIBRARY",
  "SERVICE",
  "PRODUCT",
  "FEATURE",
  "PLUGIN",
  "SKILL",
  "GUIDE",
  "CHEAT_SHEET",
  "PODCAST",
  "OTHER_TECH",
] as const;

export const CATALOG_CATEGORIES = [
  "AI development",
  "AI productivity",
  "Creative AI",
  "Data systems",
  "Design",
  "Developer tools",
  "Frontend",
  "Infrastructure",
  "Learning resources",
  "Operations",
  "Security",
  "Other",
] as const;

export const CATALOG_SORTS = ["latest", "name", "stars"] as const;

export const technologyKindSchema = z.enum(TECHNOLOGY_KINDS);
export const catalogCategorySchema = z.enum(CATALOG_CATEGORIES);
export const catalogSortSchema = z.enum(CATALOG_SORTS);

export type TechnologyKind = z.infer<typeof technologyKindSchema>;
export type CatalogCategory = z.infer<typeof catalogCategorySchema>;
export type CatalogSort = z.infer<typeof catalogSortSchema>;

const boundedText = (maximum: number) => z.string().min(1).max(maximum);
const nonNegativeCountSchema = z.number().int().min(0);
const httpUrlSchema = z
  .url()
  .max(2_048)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "URL must use HTTP or HTTPS");
const dateTimeSchema = z.iso.datetime({ offset: true });
const channelHandleSchema = z
  .string()
  .regex(/^@[a-z][a-z0-9_]{4,31}$/i, "Invalid public Telegram handle");

export const catalogMentionSchema = z
  .object({
    channelHandle: channelHandleSchema,
    channelTitle: boundedText(255).nullable(),
    channelPublicUrl: httpUrlSchema,
    sourceUrl: httpUrlSchema,
    publishedAt: dateTimeSchema,
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const catalogListItemSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: boundedText(120),
    kind: technologyKindSchema,
    category: catalogCategorySchema,
    parentName: boundedText(120).nullable(),
    canonicalUrl: httpUrlSchema.nullable(),
    githubStars: nonNegativeCountSchema.nullable(),
    githubStarsUpdatedAt: dateTimeSchema.nullable(),
    descriptionEn: boundedText(400),
    tags: z.array(boundedText(48)).max(30),
    firstMentionedAt: dateTimeSchema,
    lastMentionedAt: dateTimeSchema,
    mentionCount: nonNegativeCountSchema,
    channelCount: nonNegativeCountSchema,
  })
  .strict();

export const catalogDetailItemSchema = catalogListItemSchema
  .extend({
    mentions: z.array(catalogMentionSchema).min(1).max(1_000),
  })
  .strict();

export const catalogActiveFiltersSchema = z
  .object({
    q: z.string().max(200),
    kind: z.array(technologyKindSchema).max(TECHNOLOGY_KINDS.length),
    category: z.array(catalogCategorySchema).max(CATALOG_CATEGORIES.length),
    channel: z.array(channelHandleSchema).max(10),
    tag: z.array(boundedText(48)).max(20),
    sort: catalogSortSchema,
    limit: z.number().int().min(1).max(100),
  })
  .strict();

export const catalogListResponseSchema = z
  .object({
    items: z.array(catalogListItemSchema).max(100),
    nextCursor: z.string().min(1).max(2_048).nullable(),
    filters: catalogActiveFiltersSchema,
  })
  .strict();

export const catalogDetailResponseSchema = z
  .object({ item: catalogDetailItemSchema })
  .strict();

const categoryFacetSchema = z
  .object({
    value: catalogCategorySchema,
    count: nonNegativeCountSchema,
  })
  .strict();
const kindFacetSchema = z
  .object({
    value: technologyKindSchema,
    count: nonNegativeCountSchema,
  })
  .strict();
const channelFacetSchema = z
  .object({
    value: channelHandleSchema,
    label: boundedText(255),
    count: nonNegativeCountSchema,
  })
  .strict();
const tagFacetSchema = z
  .object({
    value: boundedText(48),
    count: nonNegativeCountSchema,
  })
  .strict();

export const catalogFacetsResponseSchema = z
  .object({
    categories: z.array(categoryFacetSchema).max(CATALOG_CATEGORIES.length),
    kinds: z.array(kindFacetSchema).max(TECHNOLOGY_KINDS.length),
    channels: z.array(channelFacetSchema).max(10),
    tags: z.array(tagFacetSchema).max(1_000),
  })
  .strict();

export const catalogChannelSchema = z
  .object({
    handle: channelHandleSchema,
    title: boundedText(255).nullable(),
    publicUrl: httpUrlSchema,
    itemCount: nonNegativeCountSchema,
    mentionCount: nonNegativeCountSchema,
    latestMentionedAt: dateTimeSchema.nullable(),
  })
  .strict();

export const catalogChannelsResponseSchema = z
  .object({ channels: z.array(catalogChannelSchema).max(10) })
  .strict();

export const API_ERROR_CODES = [
  "BAD_REQUEST",
  "NOT_FOUND",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
] as const;

export const apiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.enum(API_ERROR_CODES),
        message: boundedText(240),
        requestId: boundedText(160),
      })
      .strict(),
  })
  .strict();

export type CatalogMention = z.infer<typeof catalogMentionSchema>;
export type CatalogListItem = z.infer<typeof catalogListItemSchema>;
export type CatalogDetailItem = z.infer<typeof catalogDetailItemSchema>;
export type CatalogActiveFilters = z.infer<typeof catalogActiveFiltersSchema>;
export type CatalogListResponse = z.infer<typeof catalogListResponseSchema>;
export type CatalogDetailResponse = z.infer<typeof catalogDetailResponseSchema>;
export type CatalogFacetsResponse = z.infer<typeof catalogFacetsResponseSchema>;
export type CatalogChannel = z.infer<typeof catalogChannelSchema>;
export type CatalogChannelsResponse = z.infer<
  typeof catalogChannelsResponseSchema
>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
