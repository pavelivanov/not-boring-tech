import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  SemanticAnalysisError,
  postAnalysisSchema,
  validatePostAnalysis,
} from "./analysis-schema";
import {
  EXTRACTION_DEVELOPER_PROMPT,
  serializePostForAnalysis,
} from "./prompt";
import type {
  AnalysisFailure,
  AnalysisMetadata,
  AnalysisOutcome,
  PostAnalyzer,
  TransientPostInput,
} from "./types";

interface ParsedResponseData {
  readonly status: string;
  readonly model: string;
  readonly output_parsed: unknown;
  readonly output: readonly {
    readonly type: string;
    readonly content?: readonly { readonly type: string }[];
  }[];
  readonly usage?: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly total_tokens: number;
  } | null;
}

interface ParseResult {
  withResponse(): Promise<{
    readonly data: ParsedResponseData;
    readonly request_id: string | null;
  }>;
}

export interface OpenAiResponsesClient {
  readonly responses: {
    parse(
      body: Record<string, unknown>,
      options: { readonly maxRetries: number; readonly timeout: number },
    ): ParseResult;
  };
}

export interface OpenAiPostAnalyzerOptions {
  readonly modelId: string;
  readonly requestTimeoutMs: number;
  readonly maxAttempts: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly random?: () => number;
}

interface TokenTotals {
  input: number;
  output: number;
  total: number;
  observed: boolean;
}

const addUsage = (totals: TokenTotals, response: ParsedResponseData): void => {
  if (!response.usage) return;
  totals.input += response.usage.input_tokens;
  totals.output += response.usage.output_tokens;
  totals.total += response.usage.total_tokens;
  totals.observed = true;
};

const safeMetadata = (
  response: ParsedResponseData,
  requestId: string | null,
  attempts: number,
  totals: TokenTotals,
): AnalysisMetadata => ({
  modelId: response.model,
  requestId,
  attempts,
  inputTokens: totals.observed ? totals.input : null,
  outputTokens: totals.observed ? totals.output : null,
  totalTokens: totals.observed ? totals.total : null,
});

const failure = (
  type: AnalysisFailure["type"],
  errorClass: string,
  metadata: AnalysisMetadata | null,
): AnalysisFailure => ({ type, errorClass, metadata });

const errorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("status" in error))
    return undefined;
  return typeof error.status === "number" ? error.status : undefined;
};

const requestIdFromError = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null || !("requestID" in error))
    return null;
  return typeof error.requestID === "string" ? error.requestID : null;
};

const headerFromError = (error: unknown, name: string): string | null => {
  if (typeof error !== "object" || error === null || !("headers" in error)) {
    return null;
  }
  const headers = error.headers;
  if (headers instanceof Headers) return headers.get(name);
  if (typeof headers !== "object" || headers === null) return null;
  const value = (headers as Record<string, unknown>)[name];
  return typeof value === "string" ? value : null;
};

const retryDelayFromError = (error: unknown): number | null => {
  const millisecondHeader = headerFromError(error, "retry-after-ms");
  if (millisecondHeader !== null) {
    const milliseconds = Number(millisecondHeader);
    if (Number.isFinite(milliseconds) && milliseconds >= 0) {
      return Math.min(milliseconds, 10_000);
    }
  }

  const retryAfter = headerFromError(error, "retry-after");
  if (retryAfter === null) return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 10_000);
  }
  const dateDelay = Date.parse(retryAfter) - Date.now();
  return Number.isFinite(dateDelay)
    ? Math.min(Math.max(dateDelay, 0), 10_000)
    : null;
};

const classifyError = (
  error: unknown,
  modelId: string,
  attempts: number,
): AnalysisFailure => {
  const status = errorStatus(error);
  const metadata: AnalysisMetadata = {
    modelId,
    requestId: requestIdFromError(error),
    attempts,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
  };

  if (status === 401 || status === 403) {
    return failure("fatal_failure", "OPENAI_AUTH", metadata);
  }
  if (status === 400 || status === 404 || status === 422) {
    return failure("fatal_failure", "OPENAI_REQUEST", metadata);
  }
  if (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (status !== undefined && status >= 500) ||
    error instanceof OpenAI.APIConnectionError
  ) {
    return failure("retryable_failure", "OPENAI_TRANSIENT", metadata);
  }
  return failure("retryable_failure", "OPENAI_UNKNOWN", metadata);
};

const containsRefusal = (response: ParsedResponseData): boolean =>
  response.output.some(
    (item) =>
      item.type === "message" &&
      item.content?.some((part) => part.type === "refusal"),
  );

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class OpenAiPostAnalyzer implements PostAnalyzer {
  readonly #client: OpenAiResponsesClient;
  readonly #options: Required<OpenAiPostAnalyzerOptions>;

  constructor(
    client: OpenAiResponsesClient,
    options: OpenAiPostAnalyzerOptions,
  ) {
    this.#client = client;
    this.#options = {
      ...options,
      sleep: options.sleep ?? defaultSleep,
      random: options.random ?? Math.random,
    };
  }

  async analyze(post: TransientPostInput): Promise<AnalysisOutcome> {
    let lastFailure: AnalysisFailure | null = null;
    const totals: TokenTotals = {
      input: 0,
      output: 0,
      total: 0,
      observed: false,
    };

    for (let attempt = 1; attempt <= this.#options.maxAttempts; attempt += 1) {
      let serverRetryDelay: number | null = null;
      try {
        const request = this.#client.responses.parse(
          {
            model: this.#options.modelId,
            instructions: EXTRACTION_DEVELOPER_PROMPT,
            input: [{ role: "user", content: serializePostForAnalysis(post) }],
            text: {
              format: zodTextFormat(postAnalysisSchema, "post_analysis"),
            },
            store: false,
            background: false,
            tools: [],
          },
          { maxRetries: 0, timeout: this.#options.requestTimeoutMs },
        );
        const { data: response, request_id: requestId } =
          await request.withResponse();
        addUsage(totals, response);
        const metadata = safeMetadata(response, requestId, attempt, totals);

        if (containsRefusal(response)) {
          lastFailure = failure(
            "retryable_failure",
            "OPENAI_REFUSAL",
            metadata,
          );
        } else if (response.status !== "completed") {
          lastFailure = failure(
            "retryable_failure",
            "OPENAI_INCOMPLETE",
            metadata,
          );
        } else if (response.output_parsed === null) {
          lastFailure = failure(
            "retryable_failure",
            "OPENAI_NULL_PARSED",
            metadata,
          );
        } else {
          try {
            const analysis = validatePostAnalysis(
              response.output_parsed,
              post.links,
            );
            return { type: "success", analysis, metadata };
          } catch (error) {
            lastFailure = failure(
              "retryable_failure",
              error instanceof SemanticAnalysisError
                ? error.errorClass
                : "OPENAI_SCHEMA_VALIDATION",
              metadata,
            );
          }
        }
      } catch (error) {
        serverRetryDelay = retryDelayFromError(error);
        lastFailure = classifyError(error, this.#options.modelId, attempt);
        if (lastFailure.metadata && totals.observed) {
          lastFailure = {
            ...lastFailure,
            metadata: {
              ...lastFailure.metadata,
              inputTokens: totals.input,
              outputTokens: totals.output,
              totalTokens: totals.total,
            },
          };
        }
        if (lastFailure.type === "fatal_failure") return lastFailure;
      }

      if (attempt < this.#options.maxAttempts) {
        const exponentialDelay = Math.min(250 * 2 ** (attempt - 1), 2_000);
        const jitter = Math.floor(
          exponentialDelay * 0.25 * this.#options.random(),
        );
        await this.#options.sleep(
          Math.max(exponentialDelay + jitter, serverRetryDelay ?? 0),
        );
      }
    }

    return (
      lastFailure ??
      failure("retryable_failure", "OPENAI_UNKNOWN", {
        modelId: this.#options.modelId,
        requestId: null,
        attempts: this.#options.maxAttempts,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
      })
    );
  }
}

export const createOpenAiPostAnalyzer = (
  apiKey: string,
  options: OpenAiPostAnalyzerOptions,
): OpenAiPostAnalyzer => {
  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: options.requestTimeoutMs,
  });
  return new OpenAiPostAnalyzer(
    client as unknown as OpenAiResponsesClient,
    options,
  );
};
