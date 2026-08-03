export const PRESENTATION_KINDS = [
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

export type PresentationKind = (typeof PRESENTATION_KINDS)[number];

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
  readonly name: string;
  readonly parentName: string | null;
  readonly subjectUrl: string | null;
  readonly descriptionEn: string;
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
