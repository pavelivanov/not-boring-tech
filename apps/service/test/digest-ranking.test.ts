import type { TechnologyKind } from "@findthatproject/contracts";
import { describe, expect, it } from "vitest";

import {
  digestItemScore,
  rankDigestItems,
  type RankableDigestItem,
} from "../src/digest/ranking";

let seed = 0;

const item = (
  overrides: Partial<RankableDigestItem> & { readonly id: string },
): RankableDigestItem => {
  seed += 1;
  return {
    kind: "PROJECT",
    githubStars: null,
    lastMentionedAt: new Date(Date.UTC(2026, 8, 1, seed)),
    mentionCount: 1,
    channelCount: 1,
    ...overrides,
  };
};

describe("digestItemScore", () => {
  it("scores cross-channel mentions above star count", () => {
    const crossChannel = item({
      id: "cross",
      channelCount: 2,
      githubStars: null,
    });
    const starred = item({ id: "starred", githubStars: 44_409 });
    expect(digestItemScore(crossChannel)).toBeGreaterThan(
      digestItemScore(starred),
    );
  });

  it("returns zero for a plain single-mention item", () => {
    expect(digestItemScore(item({ id: "plain" }))).toBe(0);
  });
});

describe("rankDigestItems", () => {
  it("rejects invalid limits", () => {
    expect(() => rankDigestItems([], 0)).toThrow("DIGEST_INVALID_MAX_ITEMS");
    expect(() => rankDigestItems([], 1.5)).toThrow("DIGEST_INVALID_MAX_ITEMS");
  });

  it("returns everything selected when under the cap", () => {
    const result = rankDigestItems(
      [item({ id: "b" }), item({ id: "a", githubStars: 100 })],
      10,
    );
    expect(result.selected.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(result.overflow).toEqual([]);
  });

  it("caps selection, ranks stars first, and keeps overflow ordered", () => {
    const items = [
      ...Array.from({ length: 8 }, (_, index) =>
        item({ id: `plain-${index}` }),
      ),
      item({ id: "tiny", githubStars: 2 }),
      item({ id: "mid", githubStars: 4_268 }),
      item({ id: "top", githubStars: 44_409 }),
    ];
    const result = rankDigestItems(items, 10);
    expect(result.selected.map((entry) => entry.id).slice(0, 3)).toEqual([
      "top",
      "mid",
      "tiny",
    ]);
    expect(result.selected).toHaveLength(10);
    expect(result.overflow).toHaveLength(1);
  });

  it("reserves a slot for the best item of each kind", () => {
    const items = [
      ...Array.from({ length: 9 }, (_, index) =>
        item({ id: `project-${index}`, kind: "PROJECT", githubStars: 5_000 }),
      ),
      item({ id: "lone-guide", kind: "GUIDE" }),
      item({ id: "lone-skill", kind: "SKILL" }),
    ];
    const result = rankDigestItems(items, 10);
    const selectedIds = result.selected.map((entry) => entry.id);
    expect(selectedIds).toContain("lone-guide");
    expect(selectedIds).toContain("lone-skill");
    expect(result.overflow.map((entry) => entry.id)).toEqual(["project-0"]);
  });

  it("caps per-kind slots so one kind cannot dominate", () => {
    const items = [
      ...Array.from({ length: 8 }, (_, index) =>
        item({ id: `project-${index}`, kind: "PROJECT", githubStars: index }),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        item({ id: `tool-${index}`, kind: "TOOL" }),
      ),
    ];
    const result = rankDigestItems(items, 10);
    const kinds = result.selected.map((entry) => entry.kind);
    // cap for 10 items is ceil(10*2/5) = 4 per kind; the top-scored
    // projects still fill leftover slots once other kinds run out
    expect(kinds.filter((kind) => kind === "PROJECT")).toHaveLength(6);
    expect(kinds.filter((kind) => kind === "TOOL")).toHaveLength(4);
  });

  it("breaks ties deterministically by recency then id", () => {
    const early = item({
      id: "aaa",
      lastMentionedAt: new Date("2026-09-01T00:00:00Z"),
    });
    const late = item({
      id: "zzz",
      lastMentionedAt: new Date("2026-09-05T00:00:00Z"),
    });
    const result = rankDigestItems(
      [early, late, item({ id: "mmm", lastMentionedAt: late.lastMentionedAt })],
      10,
    );
    expect(result.selected.map((entry) => entry.id)).toEqual([
      "mmm",
      "zzz",
      "aaa",
    ]);
  });
});
