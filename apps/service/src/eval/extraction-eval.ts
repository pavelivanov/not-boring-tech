import type {
  PostAnalyzer,
  PresentationKind,
  TransientPostInput,
} from "../analyzer/types";

export interface ExpectedPresentation {
  readonly names: readonly string[];
  readonly kinds: readonly PresentationKind[];
}

export interface ExtractionEvalCase {
  readonly id: string;
  readonly text: string;
  readonly links: readonly string[];
  readonly expectedRelevant: boolean;
  readonly expectedPresentations: readonly ExpectedPresentation[];
}

export interface ExtractionEvalMetrics {
  readonly totalCases: number;
  readonly relevantCases: number;
  readonly irrelevantCases: number;
  readonly truePositiveCases: number;
  readonly falsePositiveCases: number;
  readonly falseNegativeCases: number;
  readonly trueNegativeCases: number;
  readonly relevancePrecision: number;
  readonly relevanceRecall: number;
  readonly matchedPresentations: number;
  readonly kindAccuracy: number;
  readonly urlGroundingViolations: number;
  readonly schemaRefusalIncompleteCount: number;
  readonly failedOutcomeCount: number;
  readonly totalTokens: number;
  readonly passed: boolean;
}

const normalizeName = (value: string): string =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const normalizeUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
};

const ratio = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : numerator / denominator;

const isSchemaRefusalOrIncomplete = (errorClass: string): boolean =>
  [
    "OPENAI_REFUSAL",
    "OPENAI_INCOMPLETE",
    "OPENAI_NULL_PARSED",
    "OPENAI_SCHEMA_VALIDATION",
    "SEMANTIC_VALIDATION",
  ].includes(errorClass);

const postForCase = (
  evaluationCase: ExtractionEvalCase,
  ordinal: number,
): TransientPostInput => ({
  channelHandle: "@findthatproject_eval",
  messageId: BigInt(ordinal + 1),
  text: evaluationCase.text,
  publishedAt: new Date("2026-07-30T12:00:00Z"),
  editedAt: null,
  sourceUrl: `https://t.me/findthatproject_eval/${ordinal + 1}`,
  links: evaluationCase.links,
});

export const evaluateExtractionCases = async (
  cases: readonly ExtractionEvalCase[],
  analyzer: PostAnalyzer,
): Promise<ExtractionEvalMetrics> => {
  let truePositiveCases = 0;
  let falsePositiveCases = 0;
  let falseNegativeCases = 0;
  let trueNegativeCases = 0;
  let matchedPresentations = 0;
  let correctKinds = 0;
  let urlGroundingViolations = 0;
  let schemaRefusalIncompleteCount = 0;
  let failedOutcomeCount = 0;
  let totalTokens = 0;

  for (const [ordinal, evaluationCase] of cases.entries()) {
    const outcome = await analyzer.analyze(
      postForCase(evaluationCase, ordinal),
    );
    totalTokens += outcome.metadata?.totalTokens ?? 0;

    if (outcome.type !== "success") {
      failedOutcomeCount += 1;
      if (isSchemaRefusalOrIncomplete(outcome.errorClass)) {
        schemaRefusalIncompleteCount += 1;
      }
      if (evaluationCase.expectedRelevant) falseNegativeCases += 1;
      else trueNegativeCases += 1;
      continue;
    }

    if (evaluationCase.expectedRelevant && outcome.analysis.relevant) {
      truePositiveCases += 1;
    } else if (!evaluationCase.expectedRelevant && outcome.analysis.relevant) {
      falsePositiveCases += 1;
    } else if (evaluationCase.expectedRelevant) {
      falseNegativeCases += 1;
    } else {
      trueNegativeCases += 1;
    }

    const allowedLinks = new Set(
      evaluationCase.links
        .map(normalizeUrl)
        .filter((url): url is string => url !== null),
    );
    for (const presentation of outcome.analysis.presentations) {
      if (
        presentation.subjectUrl !== null &&
        !allowedLinks.has(presentation.subjectUrl)
      ) {
        urlGroundingViolations += 1;
      }
    }

    const unmatchedPredictions = new Set(
      outcome.analysis.presentations.map((_, index) => index),
    );
    for (const expected of evaluationCase.expectedPresentations) {
      const acceptedNames = new Set(expected.names.map(normalizeName));
      const predictionIndex = [...unmatchedPredictions].find((index) => {
        const prediction = outcome.analysis.presentations[index];
        return (
          prediction !== undefined &&
          acceptedNames.has(normalizeName(prediction.name))
        );
      });
      if (predictionIndex === undefined) continue;

      unmatchedPredictions.delete(predictionIndex);
      matchedPresentations += 1;
      const prediction = outcome.analysis.presentations[predictionIndex];
      if (prediction && expected.kinds.includes(prediction.kind)) {
        correctKinds += 1;
      }
    }
  }

  const relevantCases = cases.filter((item) => item.expectedRelevant).length;
  const relevancePrecision = ratio(
    truePositiveCases,
    truePositiveCases + falsePositiveCases,
  );
  const relevanceRecall = ratio(
    truePositiveCases,
    truePositiveCases + falseNegativeCases,
  );
  const kindAccuracy = ratio(correctKinds, matchedPresentations);
  const passed =
    relevancePrecision >= 0.9 &&
    relevanceRecall >= 0.85 &&
    kindAccuracy >= 0.85 &&
    urlGroundingViolations === 0;

  return {
    totalCases: cases.length,
    relevantCases,
    irrelevantCases: cases.length - relevantCases,
    truePositiveCases,
    falsePositiveCases,
    falseNegativeCases,
    trueNegativeCases,
    relevancePrecision,
    relevanceRecall,
    matchedPresentations,
    kindAccuracy,
    urlGroundingViolations,
    schemaRefusalIncompleteCount,
    failedOutcomeCount,
    totalTokens,
    passed,
  };
};
