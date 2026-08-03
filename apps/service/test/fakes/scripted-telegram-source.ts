import type {
  ResolvedTelegramChannel,
  TelegramPage,
  TelegramSource,
} from "../../src/collector/types";

export class ScriptedTelegramSource implements TelegramSource {
  readonly incrementalCalls: Array<{
    afterMessageId: bigint;
    throughMessageId: bigint;
  }> = [];
  readonly backfillCalls: Array<{ beforeMessageId: bigint | null }> = [];
  readonly #liveEdges: Map<string, bigint | null>;
  readonly #incrementalPages: TelegramPage[];
  readonly #backfillPages: TelegramPage[];

  constructor(options: {
    liveEdges: Readonly<Record<string, bigint | null>>;
    incrementalPages?: readonly TelegramPage[];
    backfillPages?: readonly TelegramPage[];
  }) {
    this.#liveEdges = new Map(Object.entries(options.liveEdges));
    this.#incrementalPages = [...(options.incrementalPages ?? [])];
    this.#backfillPages = [...(options.backfillPages ?? [])];
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async resolveChannel(handle: string): Promise<ResolvedTelegramChannel> {
    return {
      handle,
      telegramPeerId: BigInt(
        [...handle].reduce(
          (sum, character) => sum + character.charCodeAt(0),
          0,
        ),
      ),
      title: handle.slice(1),
      publicUrl: `https://t.me/${handle.slice(1)}`,
      reference: handle,
    };
  }

  async captureLiveEdge(
    channel: ResolvedTelegramChannel,
  ): Promise<bigint | null> {
    return this.#liveEdges.get(channel.handle) ?? null;
  }

  async getIncrementalPage(
    _channel: ResolvedTelegramChannel,
    afterMessageId: bigint,
    throughMessageId: bigint,
  ): Promise<TelegramPage> {
    this.incrementalCalls.push({ afterMessageId, throughMessageId });
    const page = this.#incrementalPages.shift();
    if (!page) throw new Error("SCRIPTED_INCREMENTAL_PAGE_EXHAUSTED");
    return page;
  }

  async getBackfillPage(
    _channel: ResolvedTelegramChannel,
    beforeMessageId: bigint | null,
  ): Promise<TelegramPage> {
    this.backfillCalls.push({ beforeMessageId });
    const page = this.#backfillPages.shift();
    if (!page) throw new Error("SCRIPTED_BACKFILL_PAGE_EXHAUSTED");
    return page;
  }
}
