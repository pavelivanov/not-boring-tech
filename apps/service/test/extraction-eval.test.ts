import { describe, expect, it } from "vitest";

import type {
  AnalysisOutcome,
  PostAnalyzer,
  TransientPostInput,
} from "../src/analyzer/types";
import { extractionEvalCases } from "../src/eval/extraction-eval-cases";
import { evaluateExtractionCases } from "../src/eval/extraction-eval";

const metadata = {
  modelId: "eval-fake",
  requestId: null,
  attempts: 1,
  inputTokens: 8,
  outputTokens: 2,
  totalTokens: 10,
} as const;

class ExpectedOutcomeAnalyzer implements PostAnalyzer {
  async analyze(post: TransientPostInput): Promise<AnalysisOutcome> {
    const evaluationCase = extractionEvalCases[Number(post.messageId - 1n)];
    if (!evaluationCase) throw new Error("EVAL_CASE_NOT_FOUND");

    return {
      type: "success",
      metadata,
      analysis: {
        relevant: evaluationCase.expectedRelevant,
        presentations: evaluationCase.expectedPresentations.map(
          (presentation, index) => ({
            kind: presentation.kinds[0]!,
            category: "Other",
            name: presentation.names[0]!,
            parentName: presentation.kinds[0] === "FEATURE" ? "Parent" : null,
            subjectUrl: evaluationCase.links[index] ?? null,
            descriptionEn: "A concise synthetic evaluation description.",
            tags: ["synthetic"],
            sourceLanguage: evaluationCase.id.includes("russian")
              ? "ru"
              : evaluationCase.id.includes("spanish")
                ? "es"
                : "en",
            confidence: 0.95,
          }),
        ),
      },
    };
  }
}

describe("extraction evaluation corpus", () => {
  it("covers the required subject and negative-case distribution", () => {
    const relevantCases = extractionEvalCases.filter(
      (item) => item.expectedRelevant,
    );
    const kinds = relevantCases.flatMap((item) =>
      item.expectedPresentations.flatMap((presentation) => presentation.kinds),
    );

    expect(extractionEvalCases.length).toBeGreaterThanOrEqual(30);
    expect(relevantCases.length).toBeGreaterThanOrEqual(15);
    expect(
      extractionEvalCases.length - relevantCases.length,
    ).toBeGreaterThanOrEqual(10);
    expect(
      kinds.filter((kind) => kind === "FEATURE").length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      kinds.filter((kind) => kind === "PROJECT").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      kinds.filter((kind) => kind === "PLUGIN" || kind === "SKILL").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      kinds.filter((kind) => kind === "GUIDE" || kind === "CHEAT_SHEET").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      relevantCases.filter((item) => item.expectedPresentations.length > 1)
        .length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      extractionEvalCases.some((item) => item.id === "russian-project"),
    ).toBe(true);
    expect(extractionEvalCases.some((item) => item.id === "spanish-tool")).toBe(
      true,
    );
    expect(
      extractionEvalCases.some(
        (item) => item.id === "adversarial-instructions",
      ),
    ).toBe(true);
  });

  it("reports aggregate-only acceptance metrics", async () => {
    const metrics = await evaluateExtractionCases(
      extractionEvalCases,
      new ExpectedOutcomeAnalyzer(),
    );

    expect(metrics).toMatchObject({
      totalCases: 30,
      relevantCases: 19,
      irrelevantCases: 11,
      relevancePrecision: 1,
      relevanceRecall: 1,
      kindAccuracy: 1,
      urlGroundingViolations: 0,
      schemaRefusalIncompleteCount: 0,
      failedOutcomeCount: 0,
      totalTokens: 300,
      passed: true,
    });
    expect(JSON.stringify(metrics)).not.toContain("untrustedTelegramPost");
  });

  it("counts refusal and incomplete-style failures without exposing input", async () => {
    const analyzer: PostAnalyzer = {
      analyze: async () => ({
        type: "retryable_failure",
        errorClass: "OPENAI_REFUSAL",
        metadata,
      }),
    };
    const metrics = await evaluateExtractionCases(
      [extractionEvalCases[0]!],
      analyzer,
    );

    expect(metrics).toMatchObject({
      falseNegativeCases: 1,
      schemaRefusalIncompleteCount: 1,
      failedOutcomeCount: 1,
      passed: false,
    });
  });
});
