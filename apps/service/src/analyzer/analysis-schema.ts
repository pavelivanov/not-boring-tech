import { z } from "zod";
import { CATALOG_CATEGORIES } from "@techdex/contracts";

import {
  PRESENTATION_KINDS,
  type PostAnalysis,
  type Presentation,
} from "./types";

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 400;
const MAX_TAG_LENGTH = 48;
const MAX_LANGUAGE_LENGTH = 16;
const MAX_URL_LENGTH = 2_048;

export const presentationSchema = z
  .object({
    kind: z.enum(PRESENTATION_KINDS),
    category: z.enum(CATALOG_CATEGORIES),
    name: z.string(),
    parentName: z.string().nullable(),
    subjectUrl: z.string().nullable(),
    descriptionEn: z.string(),
    tags: z.array(z.string()).max(10),
    sourceLanguage: z.string(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const postAnalysisSchema = z
  .object({
    relevant: z.boolean(),
    presentations: z.array(presentationSchema).max(5),
  })
  .strict();

export type ParsedPostAnalysis = z.infer<typeof postAnalysisSchema>;

export class SemanticAnalysisError extends Error {
  readonly errorClass = "SEMANTIC_VALIDATION";

  constructor(message: string) {
    super(message);
    this.name = "SemanticAnalysisError";
  }
}

const normalizedHttpUrl = (value: string): string | null => {
  if (value.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
};

const boundedText = (value: string, field: string, maximum: number): string => {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new SemanticAnalysisError(
      `${field} must contain 1-${maximum} characters`,
    );
  }
  return normalized;
};

const normalizePresentation = (
  presentation: ParsedPostAnalysis["presentations"][number],
  allowedLinks: ReadonlySet<string>,
): Presentation => {
  const parentName = presentation.parentName?.trim() || null;
  if (presentation.kind !== "FEATURE" && parentName !== null) {
    throw new SemanticAnalysisError(
      "parentName is only allowed for FEATURE presentations",
    );
  }

  let subjectUrl: string | null = null;
  if (presentation.subjectUrl !== null) {
    subjectUrl = normalizedHttpUrl(presentation.subjectUrl);
    if (subjectUrl === null || !allowedLinks.has(subjectUrl)) {
      throw new SemanticAnalysisError(
        "subjectUrl must be an HTTP(S) link supplied by Telegram",
      );
    }
  }

  const tags = [
    ...new Set(
      presentation.tags.map((tag) =>
        boundedText(tag, "tag", MAX_TAG_LENGTH).toLowerCase(),
      ),
    ),
  ];

  return {
    kind: presentation.kind,
    category: presentation.category,
    name: boundedText(presentation.name, "name", MAX_NAME_LENGTH),
    parentName:
      parentName === null
        ? null
        : boundedText(parentName, "parentName", MAX_NAME_LENGTH),
    subjectUrl,
    descriptionEn: boundedText(
      presentation.descriptionEn,
      "descriptionEn",
      MAX_DESCRIPTION_LENGTH,
    ),
    tags,
    sourceLanguage: boundedText(
      presentation.sourceLanguage.toLowerCase(),
      "sourceLanguage",
      MAX_LANGUAGE_LENGTH,
    ),
    confidence: presentation.confidence,
  };
};

export const validatePostAnalysis = (
  input: unknown,
  sourceLinks: readonly string[],
): PostAnalysis => {
  const parsed = postAnalysisSchema.parse(input);
  if (parsed.relevant !== parsed.presentations.length > 0) {
    throw new SemanticAnalysisError(
      "relevant must be true exactly when at least one presentation is returned",
    );
  }

  const allowedLinks = new Set(
    sourceLinks
      .map(normalizedHttpUrl)
      .filter((link): link is string => link !== null),
  );

  return {
    relevant: parsed.relevant,
    presentations: parsed.presentations.map((presentation) =>
      normalizePresentation(presentation, allowedLinks),
    ),
  };
};
