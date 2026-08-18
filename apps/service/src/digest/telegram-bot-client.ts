import { z } from "zod";

const successResponseSchema = z.object({
  ok: z.literal(true),
  result: z.object({ message_id: z.number().int().positive() }),
});

const errorResponseSchema = z.object({
  ok: z.literal(false),
  error_code: z.number().int(),
  description: z.string().optional(),
  parameters: z
    .object({ retry_after: z.number().int().nonnegative().optional() })
    .optional(),
});

export interface TelegramDigestPublisher {
  sendMessage(input: {
    readonly chatId: string;
    readonly html: string;
  }): Promise<{ readonly messageId: bigint; readonly attempts: number }>;
}

export interface TelegramBotClientOptions {
  readonly token: string;
  readonly requestTimeoutMs: number;
  readonly maxAttempts: number;
  readonly fetch?: typeof globalThis.fetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

export class TelegramPublishError extends Error {
  readonly errorClass: string;
  readonly ambiguous: boolean;
  readonly attempts: number;

  constructor(errorClass: string, ambiguous: boolean, attempts: number) {
    super(errorClass);
    this.name = "TelegramPublishError";
    this.errorClass = errorClass;
    this.ambiguous = ambiguous;
    this.attempts = attempts;
  }
}

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const statusErrorClass = (status: number): string => {
  if (status === 401 || status === 404) return "TELEGRAM_AUTH";
  if (status === 403) return "TELEGRAM_TARGET";
  if (status === 400 || status === 413 || status === 422) {
    return "TELEGRAM_PAYLOAD";
  }
  if (status === 429) return "TELEGRAM_RATE_LIMIT";
  if (status >= 500) return "TELEGRAM_SERVER";
  return "TELEGRAM_REJECTED";
};

const isSafeToRetry = (status: number): boolean =>
  status === 429 || status >= 500;

export class TelegramBotApiClient implements TelegramDigestPublisher {
  readonly #endpoint: string;
  readonly #requestTimeoutMs: number;
  readonly #maxAttempts: number;
  readonly #fetch: typeof globalThis.fetch;
  readonly #sleep: (milliseconds: number) => Promise<void>;

  constructor(options: TelegramBotClientOptions) {
    if (!options.token.trim()) throw new Error("TELEGRAM_CONFIG");
    if (
      !Number.isInteger(options.requestTimeoutMs) ||
      options.requestTimeoutMs < 1_000 ||
      options.requestTimeoutMs > 30_000 ||
      !Number.isInteger(options.maxAttempts) ||
      options.maxAttempts < 1 ||
      options.maxAttempts > 3
    ) {
      throw new Error("TELEGRAM_CONFIG");
    }
    this.#endpoint = `https://api.telegram.org/bot${options.token}/sendMessage`;
    this.#requestTimeoutMs = options.requestTimeoutMs;
    this.#maxAttempts = options.maxAttempts;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#sleep = options.sleep ?? defaultSleep;
  }

  async sendMessage(input: {
    readonly chatId: string;
    readonly html: string;
  }): Promise<{ readonly messageId: bigint; readonly attempts: number }> {
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.#fetch(this.#endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: input.chatId,
            text: input.html,
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
          }),
          signal: AbortSignal.timeout(this.#requestTimeoutMs),
        });
      } catch {
        throw new TelegramPublishError("TELEGRAM_AMBIGUOUS", true, attempt);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        if (response.ok) {
          throw new TelegramPublishError(
            "TELEGRAM_AMBIGUOUS_RESPONSE",
            true,
            attempt,
          );
        }
        const errorClass = statusErrorClass(response.status);
        if (isSafeToRetry(response.status) && attempt < this.#maxAttempts) {
          continue;
        }
        throw new TelegramPublishError(errorClass, false, attempt);
      }

      const success = successResponseSchema.safeParse(payload);
      if (response.ok && success.success) {
        return {
          messageId: BigInt(success.data.result.message_id),
          attempts: attempt,
        };
      }

      const failure = errorResponseSchema.safeParse(payload);
      if (response.ok && !failure.success) {
        throw new TelegramPublishError(
          "TELEGRAM_AMBIGUOUS_RESPONSE",
          true,
          attempt,
        );
      }

      const errorStatus = failure.success
        ? failure.data.error_code
        : response.status;
      const errorClass = statusErrorClass(errorStatus);
      if (isSafeToRetry(errorStatus) && attempt < this.#maxAttempts) {
        if (errorStatus === 429 && failure.success) {
          const retryAfterSeconds = failure.data.parameters?.retry_after ?? 0;
          await this.#sleep(Math.min(retryAfterSeconds * 1_000, 60_000));
        }
        continue;
      }
      throw new TelegramPublishError(errorClass, false, attempt);
    }

    throw new TelegramPublishError(
      "TELEGRAM_RETRY_EXHAUSTED",
      false,
      this.#maxAttempts,
    );
  }
}
