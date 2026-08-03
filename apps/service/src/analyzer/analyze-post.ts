import type {
  AnalysisOutcome,
  PostAnalyzer,
  TransientPostInput,
} from "./types";

export const analyzePost = (
  analyzer: PostAnalyzer,
  post: TransientPostInput,
): Promise<AnalysisOutcome> => analyzer.analyze(post);
