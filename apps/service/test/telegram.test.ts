import bigInt from "big-integer";
import { Api } from "telegram";
import { describe, expect, it, vi } from "vitest";

import type { ResolvedTelegramChannel } from "../src/collector/types";
import {
  GramJsTelegramSource,
  mapTelegramMessage,
} from "../src/telegram/gramjs-client";

const channel: ResolvedTelegramChannel = {
  handle: "@notboring_tech",
  telegramPeerId: 123n,
  title: "Not Boring Tech",
  publicUrl: "https://t.me/notboring_tech",
  reference: { channel: true },
};

const telegramMessage = (
  id: number,
  message = `Post ${id}`,
  overrides: Record<string, unknown> = {},
) =>
  new Api.Message({
    id,
    peerId: new Api.PeerChannel({ channelId: bigInt(123) }),
    date: 1_800_000_000 + id,
    message,
    out: false,
    mentioned: false,
    mediaUnread: false,
    silent: false,
    post: true,
    fromScheduled: false,
    legacy: false,
    editHide: false,
    pinned: false,
    noforwards: false,
    ...overrides,
  });

const clientWithMessages = (messages: readonly unknown[]) => {
  const iterMessages = vi.fn().mockImplementation(async function* () {
    for (const message of messages) yield message;
  });
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    checkAuthorization: vi.fn().mockResolvedValue(true),
    getEntity: vi.fn(),
    iterMessages,
  };
};

describe("mapTelegramMessage", () => {
  it("maps only transient fields and normalizes supplied links", () => {
    const text = "Read docs and https://example.com/direct.";
    const message = telegramMessage(4107, text, {
      editDate: 1_800_000_500,
      entities: [
        new Api.MessageEntityTextUrl({
          offset: 5,
          length: 4,
          url: "https://example.com/linked",
        }),
      ],
      media: new Api.MessageMediaWebPage({
        webpage: new Api.WebPage({
          id: bigInt(1),
          url: "https://example.com/preview",
          displayUrl: "example.com",
          hash: 1,
        }),
      }),
    });

    expect(mapTelegramMessage(channel, message)).toEqual({
      channelHandle: "@notboring_tech",
      messageId: 4107n,
      text,
      publishedAt: new Date((1_800_000_000 + 4107) * 1_000),
      editedAt: new Date(1_800_000_500 * 1_000),
      sourceUrl: "https://t.me/notboring_tech/4107",
      links: [
        "https://example.com/linked",
        "https://example.com/direct",
        "https://example.com/preview",
      ],
    });
  });
});

describe("GramJsTelegramSource", () => {
  it("requires a pre-authorized session", async () => {
    const client = clientWithMessages([]);
    client.checkAuthorization.mockResolvedValue(false);
    await expect(new GramJsTelegramSource(client).connect()).rejects.toThrow(
      "TELEGRAM_UNAUTHORIZED",
    );
  });

  it("uses correctly reversed offset semantics for incrementals", async () => {
    const client = clientWithMessages([
      telegramMessage(11),
      telegramMessage(12),
      telegramMessage(13),
    ]);
    const source = new GramJsTelegramSource(client);
    const page = await source.getIncrementalPage(channel, 10n, 12n, 3);

    expect(page.posts.map((post) => post.messageId)).toEqual([11n, 12n]);
    expect(page.reachedBoundary).toBe(true);
    expect(client.iterMessages).toHaveBeenCalledWith(channel.reference, {
      limit: 3,
      offsetId: 10,
      reverse: true,
    });
  });

  it("keeps historical fetch newest-to-oldest and reverses only the bounded page", async () => {
    const client = clientWithMessages([
      telegramMessage(30),
      telegramMessage(29),
      telegramMessage(28),
    ]);
    const source = new GramJsTelegramSource(client);
    const page = await source.getBackfillPage(
      channel,
      31n,
      new Date("2020-01-01T00:00:00Z"),
      3,
    );

    expect(page.posts.map((post) => post.messageId)).toEqual([28n, 29n, 30n]);
    expect(page.nextBeforeMessageId).toBe(28n);
    expect(client.iterMessages).toHaveBeenCalledWith(channel.reference, {
      limit: 3,
      offsetId: 31,
      reverse: false,
    });
  });

  it("stops backfill at the fixed cutoff", async () => {
    const recent = telegramMessage(20, "recent", { date: 1_800_000_000 });
    const old = telegramMessage(19, "old", { date: 1_600_000_000 });
    const source = new GramJsTelegramSource(clientWithMessages([recent, old]));
    const page = await source.getBackfillPage(
      channel,
      null,
      new Date("2023-01-01T00:00:00Z"),
      10,
    );
    expect(page.posts.map((post) => post.messageId)).toEqual([20n]);
    expect(page.reachedBoundary).toBe(true);
  });
});
