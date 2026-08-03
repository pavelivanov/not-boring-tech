import { describe, expect, it, vi } from "vitest";

import {
  OpenAiPostAnalyzer,
  type OpenAiResponsesClient,
} from "../src/analyzer/openai-post-analyzer";
import { EXTRACTION_DEVELOPER_PROMPT } from "../src/analyzer/prompt";
import type { TransientPostInput } from "../src/analyzer/types";

const post: TransientPostInput = {
  channelHandle: "@notboring_tech",
  messageId: 4107n,
  text: "Nanochat is a compact project for learning how chat models work.",
  publishedAt: new Date("2026-07-30T10:00:00Z"),
  editedAt: null,
  sourceUrl: "https://t.me/notboring_tech/4107",
  links: ["https://github.com/karpathy/nanochat"],
};

const parsedPresentation = {
  relevant: true,
  presentations: [
    {
      kind: "PROJECT",
      category: "Learning resources",
      name: "Nanochat",
      parentName: null,
      subjectUrl: "https://github.com/karpathy/nanochat",
      descriptionEn: "A compact project for learning how chat models work.",
      tags: ["ai", "learning"],
      sourceLanguage: "en",
      confidence: 0.95,
    },
  ],
};

const response = (overrides: Record<string, unknown> = {}) => ({
  status: "completed",
  model: "model-a",
  output_parsed: parsedPresentation,
  output: [{ type: "message", content: [{ type: "output_text" }] }],
  usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  ...overrides,
});

const clientWith = (...responses: ReturnType<typeof response>[]) => {
  const parse = vi.fn().mockImplementation(() => {
    const next = responses.shift();
    if (!next) throw new Error("NO_RESPONSE");
    return {
      withResponse: vi
        .fn()
        .mockResolvedValue({ data: next, request_id: "req_safe" }),
    };
  });
  return { client: { responses: { parse } } as OpenAiResponsesClient, parse };
};

const createAnalyzer = (client: OpenAiResponsesClient, maxAttempts = 3) =>
  new OpenAiPostAnalyzer(client, {
    modelId: "model-a",
    requestTimeoutMs: 5_000,
    maxAttempts,
    sleep: vi.fn().mockResolvedValue(undefined),
    random: () => 0,
  });

describe("OpenAiPostAnalyzer", () => {
  it("constructs a stateless strict request with no tools", async () => {
    const { client, parse } = clientWith(response());
    const outcome = await createAnalyzer(client).analyze(post);

    expect(outcome).toMatchObject({
      type: "success",
      metadata: {
        requestId: "req_safe",
        attempts: 1,
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
    });
    const [body, options] = parse.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(body).toMatchObject({
      model: "model-a",
      instructions: EXTRACTION_DEVELOPER_PROMPT,
      store: false,
      background: false,
      tools: [],
    });
    expect(options).toEqual({ maxRetries: 0, timeout: 5_000 });
    expect(body.text).toMatchObject({
      format: {
        type: "json_schema",
        strict: true,
        schema: { type: "object", additionalProperties: false },
      },
    });
    expect(JSON.stringify(body)).toContain(post.text);
  });

  it("retries refusal and incomplete output within the total attempt cap", async () => {
    const { client, parse } = clientWith(
      response({
        output_parsed: null,
        output: [{ type: "message", content: [{ type: "refusal" }] }],
      }),
      response({ status: "incomplete", output_parsed: null }),
      response(),
    );
    const outcome = await createAnalyzer(client).analyze(post);
    expect(outcome).toMatchObject({
      type: "success",
      metadata: {
        attempts: 3,
        inputTokens: 300,
        outputTokens: 150,
        totalTokens: 450,
      },
    });
    expect(parse).toHaveBeenCalledTimes(3);
  });

  it("returns a sanitized retryable failure after semantic failures reach the cap", async () => {
    const invented = response({
      output_parsed: {
        ...parsedPresentation,
        presentations: [
          {
            ...parsedPresentation.presentations[0],
            subjectUrl: "https://invented.example",
          },
        ],
      },
    });
    const { client } = clientWith(invented, invented);
    const outcome = await createAnalyzer(client, 2).analyze(post);
    expect(outcome).toEqual({
      type: "retryable_failure",
      errorClass: "SEMANTIC_VALIDATION",
      metadata: {
        modelId: "model-a",
        requestId: "req_safe",
        attempts: 2,
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
      },
    });
    expect(JSON.stringify(outcome)).not.toContain("invented.example");
  });

  it("stops immediately on authentication failures", async () => {
    const parse = vi.fn().mockImplementation(() => ({
      withResponse: vi
        .fn()
        .mockRejectedValue({ status: 401, requestID: "req_auth" }),
    }));
    const client = { responses: { parse } } as OpenAiResponsesClient;
    const outcome = await createAnalyzer(client).analyze(post);
    expect(outcome).toMatchObject({
      type: "fatal_failure",
      errorClass: "OPENAI_AUTH",
      metadata: { requestId: "req_auth", attempts: 1 },
    });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("retries rate limits using bounded server retry guidance", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const parse = vi
      .fn()
      .mockImplementationOnce(() => ({
        withResponse: vi.fn().mockRejectedValue({
          status: 429,
          requestID: "req_rate_limit",
          headers: new Headers({ "retry-after-ms": "750" }),
        }),
      }))
      .mockImplementationOnce(() => ({
        withResponse: vi
          .fn()
          .mockResolvedValue({ data: response(), request_id: "req_success" }),
      }));
    const analyzer = new OpenAiPostAnalyzer(
      { responses: { parse } } as OpenAiResponsesClient,
      {
        modelId: "model-a",
        requestTimeoutMs: 5_000,
        maxAttempts: 2,
        sleep,
        random: () => 0,
      },
    );

    await expect(analyzer.analyze(post)).resolves.toMatchObject({
      type: "success",
      metadata: { attempts: 2, requestId: "req_success" },
    });
    expect(sleep).toHaveBeenCalledWith(750);
    expect(parse).toHaveBeenCalledTimes(2);
  });
});
