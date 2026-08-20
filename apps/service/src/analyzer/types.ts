import {
  TECHNOLOGY_KINDS,
  type CatalogCategory,
  type TechnologyKind,
} from "@findthatproject/contracts";

export const PRESENTATION_KINDS = TECHNOLOGY_KINDS;

export type PresentationKind = TechnologyKind;

export interface TransientPostInput {
  readonly channelHandle: string;
  readonly messageId: bigint;
  readonly text: string;
  readonly publishedAt: Date;
  readonly editedAt: Date | null;
  readonly sourceUrl: string;
  readonly links: readonly string[];
}

export interface Presentation {
  readonly kind: PresentationKind;
  readonly category: CatalogCategory;
  readonly name: string;
  readonly nameRu: string;
  readonly parentName: string | null;
  readonly parentNameRu: string | null;
  readonly subjectUrl: string | null;
  readonly githubUrl: string | null;
  readonly descriptionEn: string;
  readonly descriptionRu: string;
  readonly tags: readonly string[];
  readonly sourceLanguage: string;
  readonly confidence: number;
}

export interface PostAnalysis {
  readonly relevant: boolean;
  readonly presentations: readonly Presentation[];
}

export interface AnalysisMetadata {
  readonly modelId: string;
  readonly requestId: string | null;
  readonly attempts: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
}

export interface AnalysisSuccess {
  readonly type: "success";
  readonly analysis: PostAnalysis;
  readonly metadata: AnalysisMetadata;
}

export interface AnalysisFailure {
  readonly type: "retryable_failure" | "fatal_failure";
  readonly errorClass: string;
  readonly metadata: AnalysisMetadata | null;
}

export type AnalysisOutcome = AnalysisSuccess | AnalysisFailure;

export interface PostAnalyzer {
  analyze(post: TransientPostInput): Promise<AnalysisOutcome>;
}
