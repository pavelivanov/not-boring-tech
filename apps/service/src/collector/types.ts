import type { TransientPostInput } from "../analyzer/types";

export interface ResolvedTelegramChannel {
  readonly handle: string;
  readonly telegramPeerId: bigint;
  readonly title: string;
  readonly publicUrl: string;
  readonly reference: unknown;
}

export interface TelegramPage {
  readonly posts: readonly TransientPostInput[];
  readonly reachedBoundary: boolean;
  readonly nextBeforeMessageId: bigint | null;
}

export interface TelegramSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  resolveChannel(handle: string): Promise<ResolvedTelegramChannel>;
  captureLiveEdge(channel: ResolvedTelegramChannel): Promise<bigint | null>;
  getIncrementalPage(
    channel: ResolvedTelegramChannel,
    afterMessageId: bigint,
    throughMessageId: bigint,
    limit: number,
  ): Promise<TelegramPage>;
  getBackfillPage(
    channel: ResolvedTelegramChannel,
    beforeMessageId: bigint | null,
    cutoffAt: Date,
    limit: number,
  ): Promise<TelegramPage>;
}
