import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

import type { TransientPostInput } from "../analyzer/types";
import type {
  ResolvedTelegramChannel,
  TelegramPage,
  TelegramSource,
} from "../collector/types";

interface TelegramMessageLike {
  readonly id: number;
  readonly message: string;
  readonly date: number;
  readonly editDate?: number;
  readonly entities?: readonly Api.TypeMessageEntity[];
  readonly media?: Api.TypeMessageMedia;
}

interface GramJsClientLike {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  checkAuthorization(): Promise<boolean>;
  getEntity(entity: string): Promise<unknown>;
  iterMessages(
    entity: unknown,
    options: Record<string, unknown>,
  ): AsyncIterable<unknown>;
}

export interface GramJsTelegramSourceOptions {
  readonly apiId: number;
  readonly apiHash: string;
  readonly session: string;
}

const normalizedHttpUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
};

const extractLinks = (message: TelegramMessageLike): readonly string[] => {
  const links = new Set<string>();
  const addLink = (value: string) => {
    const normalized = normalizedHttpUrl(value);
    if (normalized) links.add(normalized);
  };

  for (const entity of message.entities ?? []) {
    if (entity instanceof Api.MessageEntityTextUrl) {
      addLink(entity.url);
    } else if (entity instanceof Api.MessageEntityUrl) {
      addLink(
        message.message.slice(entity.offset, entity.offset + entity.length),
      );
    }
  }

  for (const match of message.message.matchAll(/https?:\/\/[^\s<>"']+/giu)) {
    if (match[0]) addLink(match[0].replace(/[),.;!?]+$/u, ""));
  }

  if (
    message.media instanceof Api.MessageMediaWebPage &&
    message.media.webpage instanceof Api.WebPage
  ) {
    addLink(message.media.webpage.url);
  }

  return [...links];
};

export const mapTelegramMessage = (
  channel: Pick<ResolvedTelegramChannel, "handle" | "publicUrl">,
  message: TelegramMessageLike,
): TransientPostInput => ({
  channelHandle: channel.handle,
  messageId: BigInt(message.id),
  text: message.message,
  publishedAt: new Date(message.date * 1_000),
  editedAt:
    message.editDate === undefined ? null : new Date(message.editDate * 1_000),
  sourceUrl: `${channel.publicUrl}/${message.id}`,
  links: extractLinks(message),
});

const toSafeMessageId = (value: bigint): number => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 0)
    throw new Error("TELEGRAM_MESSAGE_ID_RANGE");
  return id;
};

const ascending = (
  posts: readonly TransientPostInput[],
): readonly TransientPostInput[] =>
  [...posts].sort((left, right) => (left.messageId < right.messageId ? -1 : 1));

export class GramJsTelegramSource implements TelegramSource {
  readonly #client: GramJsClientLike;

  constructor(client: GramJsClientLike) {
    this.#client = client;
  }

  async connect(): Promise<void> {
    await this.#client.connect();
    if (!(await this.#client.checkAuthorization())) {
      throw new Error("TELEGRAM_UNAUTHORIZED");
    }
  }

  disconnect(): Promise<void> {
    return this.#client.disconnect();
  }

  async resolveChannel(handle: string): Promise<ResolvedTelegramChannel> {
    const normalizedHandle = handle.toLowerCase();
    const entity = await this.#client.getEntity(normalizedHandle);
    if (
      !(entity instanceof Api.Channel) ||
      entity.broadcast !== true ||
      !entity.username
    ) {
      throw new Error("TELEGRAM_NOT_PUBLIC_BROADCAST");
    }
    if (`@${entity.username.toLowerCase()}` !== normalizedHandle) {
      throw new Error("TELEGRAM_HANDLE_MISMATCH");
    }

    return {
      handle: normalizedHandle,
      telegramPeerId: BigInt(entity.id.toString()),
      title: entity.title,
      publicUrl: `https://t.me/${entity.username}`,
      reference: entity,
    };
  }

  async captureLiveEdge(
    channel: ResolvedTelegramChannel,
  ): Promise<bigint | null> {
    for await (const message of this.#client.iterMessages(channel.reference, {
      limit: 1,
      reverse: false,
    })) {
      if (message instanceof Api.Message) return BigInt(message.id);
    }
    return null;
  }

  async getIncrementalPage(
    channel: ResolvedTelegramChannel,
    afterMessageId: bigint,
    throughMessageId: bigint,
    limit: number,
  ): Promise<TelegramPage> {
    const posts: TransientPostInput[] = [];
    let observedMessages = 0;

    for await (const message of this.#client.iterMessages(channel.reference, {
      limit,
      offsetId: toSafeMessageId(afterMessageId),
      reverse: true,
    })) {
      if (!(message instanceof Api.Message)) continue;
      observedMessages += 1;
      const messageId = BigInt(message.id);
      if (messageId > throughMessageId) break;
      posts.push(mapTelegramMessage(channel, message));
    }

    const lastMessageId = posts.at(-1)?.messageId ?? afterMessageId;
    return {
      posts,
      reachedBoundary:
        lastMessageId >= throughMessageId || observedMessages < limit,
      nextBeforeMessageId: null,
    };
  }

  async getBackfillPage(
    channel: ResolvedTelegramChannel,
    beforeMessageId: bigint | null,
    cutoffAt: Date,
    limit: number,
  ): Promise<TelegramPage> {
    const posts: TransientPostInput[] = [];
    let observedMessages = 0;
    let reachedCutoff = false;

    for await (const message of this.#client.iterMessages(channel.reference, {
      limit,
      offsetId: beforeMessageId === null ? 0 : toSafeMessageId(beforeMessageId),
      reverse: false,
    })) {
      if (!(message instanceof Api.Message)) continue;
      observedMessages += 1;
      const mapped = mapTelegramMessage(channel, message);
      if (mapped.publishedAt < cutoffAt) {
        reachedCutoff = true;
        continue;
      }
      posts.push(mapped);
    }

    const oldestMessageId = posts.reduce<bigint | null>(
      (oldest, post) =>
        oldest === null || post.messageId < oldest ? post.messageId : oldest,
      null,
    );
    return {
      posts: ascending(posts),
      reachedBoundary: reachedCutoff || observedMessages < limit,
      nextBeforeMessageId: oldestMessageId,
    };
  }
}

export const createGramJsTelegramSource = (
  options: GramJsTelegramSourceOptions,
): GramJsTelegramSource => {
  const client = new TelegramClient(
    new StringSession(options.session),
    options.apiId,
    options.apiHash,
    {
      connectionRetries: 2,
      autoReconnect: false,
      floodSleepThreshold: 0,
    },
  );
  return new GramJsTelegramSource(client as unknown as GramJsClientLike);
};
