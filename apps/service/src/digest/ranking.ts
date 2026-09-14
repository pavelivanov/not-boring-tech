import type { TechnologyKind } from "@findthatproject/contracts";

export interface RankableDigestItem {
  readonly id: string;
  readonly kind: TechnologyKind;
  readonly githubStars: number | null;
  readonly lastMentionedAt: Date;
  readonly mentionCount: number;
  readonly channelCount: number;
}

export const CHANNEL_MENTION_WEIGHT = 2;
export const EXTRA_MENTION_WEIGHT = 0.5;
export const STARS_WEIGHT_DIVISOR = 5;

export const digestItemScore = (item: RankableDigestItem): number => {
  const starsScore =
    item.githubStars === null
      ? 0
      : Math.log10(item.githubStars + 1) / STARS_WEIGHT_DIVISOR;
  return (
    CHANNEL_MENTION_WEIGHT * (item.channelCount - 1) +
    EXTRA_MENTION_WEIGHT * (item.mentionCount - 1) +
    starsScore
  );
};

const compareItems = (left: RankableDigestItem, right: RankableDigestItem) => {
  const scoreDelta = digestItemScore(right) - digestItemScore(left);
  if (scoreDelta !== 0) return scoreDelta;
  const recencyDelta =
    right.lastMentionedAt.getTime() - left.lastMentionedAt.getTime();
  if (recencyDelta !== 0) return recencyDelta;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
};

export interface DigestRanking {
  /**
   * Items ordered for the Telegram post; at most `maxItems` entries.
   */
  readonly selected: readonly RankableDigestItem[];
  /**
   * Remaining items, best first, for the overflow page.
   */
  readonly overflow: readonly RankableDigestItem[];
}

const kindCap = (maxItems: number): number =>
  Math.max(1, Math.ceil((maxItems * 2) / 5));

/**
 * Ranks digest items by interestingness (cross-channel mentions, mention
 * volume, log-scaled GitHub stars) while reserving one slot for the best
 * item of each kind so the cut cannot drop entire kinds.
 */
export const rankDigestItems = (
  items: readonly RankableDigestItem[],
  maxItems: number,
): DigestRanking => {
  if (!Number.isInteger(maxItems) || maxItems < 1) {
    throw new Error("DIGEST_INVALID_MAX_ITEMS");
  }
  if (items.length <= maxItems) {
    return { selected: [...items].sort(compareItems), overflow: [] };
  }

  const ordered = [...items].sort(compareItems);
  const selected: RankableDigestItem[] = [];
  const selectedIds = new Set<string>();
  const perKind = new Map<TechnologyKind, number>();
  const cap = kindCap(maxItems);

  const push = (item: RankableDigestItem): boolean => {
    if (selected.length >= maxItems || selectedIds.has(item.id)) return false;
    selected.push(item);
    selectedIds.add(item.id);
    perKind.set(item.kind, (perKind.get(item.kind) ?? 0) + 1);
    return true;
  };
  const tryPush = (item: RankableDigestItem): boolean => {
    if ((perKind.get(item.kind) ?? 0) >= cap) return false;
    return push(item);
  };

  // Reserve one slot for the best item of each kind present this week.
  for (const item of ordered) {
    if (perKind.has(item.kind)) continue;
    tryPush(item);
  }

  for (const item of ordered) {
    tryPush(item);
  }

  // The kind cap is a diversity preference, not a hard limit: if slots remain
  // (e.g. one kind dominates the week), keep filling by score.
  for (const item of ordered) {
    if (selected.length >= maxItems) break;
    push(item);
  }

  const overflow = ordered.filter((item) => !selectedIds.has(item.id));
  return { selected, overflow };
};
