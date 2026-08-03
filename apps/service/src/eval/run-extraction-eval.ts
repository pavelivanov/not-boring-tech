import { createOpenAiPostAnalyzer } from "../analyzer/openai-post-analyzer";
import { ConfigError, parseExtractionEvalConfig } from "../config";
import { extractionEvalCases } from "./extraction-eval-cases";
import { evaluateExtractionCases } from "./extraction-eval";

const main = async (): Promise<void> => {
  const config = parseExtractionEvalConfig();
  const analyzer = createOpenAiPostAnalyzer(config.OPENAI_API_KEY, {
    modelId: config.OPENAI_MODEL,
    requestTimeoutMs: config.OPENAI_REQUEST_TIMEOUT_MS,
    maxAttempts: config.OPENAI_MAX_ATTEMPTS,
  });
  const metrics = await evaluateExtractionCases(extractionEvalCases, analyzer);
  process.stdout.write(`${JSON.stringify(metrics)}\n`);
  if (!metrics.passed) process.exitCode = 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof ConfigError ? "CONFIG_INVALID" : "EVAL_FAILED"}\n`,
    );
    process.exitCode = 1;
  });
}
