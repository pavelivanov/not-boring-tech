import { describe, expect, it, vi } from "vitest";

import {
  TelegramBotApiClient,
  TelegramPublishError,
} from "../src/digest/telegram-bot-client";

const tokenSentinel = "token-secret-sentinel";
const targetSentinel = "@private-target-sentinel";
const htmlSentinel = "<b>private-html-sentinel</b>";

const client = (
  request: typeof fetch,
  overrides: {
    maxAttempts?: number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
) =>
  new TelegramBotApiClient({
    token: tokenSentinel,
    requestTimeoutMs: 5_000,
    maxAttempts: overrides.maxAttempts ?? 3,
    fetch: request,
    sleep: overrides.sleep ?? vi.fn().mockResolvedValue(undefined),
  });

const send = (publisher: TelegramBotApiClient) =>
  publisher.sendMessage({ chatId: targetSentinel, html: htmlSentinel });

const rejectedResponse = (
  status: number,
  description = "response-description-sentinel",
  parameters?: { retry_after: number },
): Response =>
  new Response(
    JSON.stringify({
      ok: false,
      error_code: status,
      description,
      ...(parameters === undefined ? {} : { parameters }),
    }),
    { status },
  );

const safeErrorText = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
    throw new Error("EXPECTED_REJECTION");
  } catch (error) {
    expect(error).toBeInstanceOf(TelegramPublishError);
    return String(error);
  }
};

describe("TelegramBotApiClient", () => {
  it("posts HTML with previews disabled and returns the positive message ID", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), {
        status: 200,
      }),
    );

    await expect(send(client(request))).resolves.toEqual({
      messageId: 42n,
      attempts: 1,
    });
    expect(request).toHaveBeenCalledWith(
      `https://api.telegram.org/bot${tokenSentinel}/sendMessage`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: targetSentinel,
          text: htmlSentinel,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        }),
      }),
    );
  });

  it.each([
    [400, "TELEGRAM_PAYLOAD"],
    [401, "TELEGRAM_AUTH"],
    [403, "TELEGRAM_TARGET"],
  ])(
    "classifies an explicit %s rejection as %s",
    async (status, errorClass) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(rejectedResponse(status));
      const errorText = await safeErrorText(send(client(request)));

      expect(errorText).toContain(errorClass);
      expect(request).toHaveBeenCalledTimes(1);
      expect(errorText).not.toContain(tokenSentinel);
      expect(errorText).not.toContain(targetSentinel);
      expect(errorText).not.toContain(htmlSentinel);
      expect(errorText).not.toContain("response-description-sentinel");
    },
  );

  it("honors bounded retry_after guidance before a successful retry", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        rejectedResponse(429, "slow down", { retry_after: 90 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: { message_id: 9 } }), {
          status: 200,
        }),
      );

    await expect(send(client(request, { sleep }))).resolves.toEqual({
      messageId: 9n,
      attempts: 2,
    });
    expect(sleep).toHaveBeenCalledWith(60_000);
  });

  it("retries explicit server rejections only to the configured cap", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(rejectedResponse(503));
    const publisher = client(request, { maxAttempts: 2 });

    await expect(send(publisher)).rejects.toMatchObject({
      errorClass: "TELEGRAM_SERVER",
      ambiguous: false,
      attempts: 2,
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("treats malformed success JSON as ambiguous", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("not-json", { status: 200 }));

    await expect(send(client(request))).rejects.toMatchObject({
      errorClass: "TELEGRAM_AMBIGUOUS_RESPONSE",
      ambiguous: true,
      attempts: 1,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(["timeout", "connection loss"])(
    "does not retry an ambiguous %s",
    async () => {
      const request = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error("network-error-sentinel"));

      await expect(send(client(request))).rejects.toMatchObject({
        errorClass: "TELEGRAM_AMBIGUOUS",
        ambiguous: true,
        attempts: 1,
      });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
});
