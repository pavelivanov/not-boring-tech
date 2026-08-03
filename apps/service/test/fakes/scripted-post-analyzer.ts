import type {
  AnalysisOutcome,
  PostAnalyzer,
  TransientPostInput,
} from "../../src/analyzer/types";

export class ScriptedPostAnalyzer implements PostAnalyzer {
  readonly calls: TransientPostInput[] = [];
  readonly #outcomes: AnalysisOutcome[];

  constructor(outcomes: readonly AnalysisOutcome[]) {
    this.#outcomes = [...outcomes];
  }

  async analyze(post: TransientPostInput): Promise<AnalysisOutcome> {
    this.calls.push(post);
    const outcome = this.#outcomes.shift();
    if (!outcome) throw new Error("SCRIPTED_ANALYZER_EXHAUSTED");
    return outcome;
  }
}
