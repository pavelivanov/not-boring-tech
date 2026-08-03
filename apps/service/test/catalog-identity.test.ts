import { describe, expect, it } from "vitest";

import {
  canonicalizeSubjectUrl,
  deriveCatalogIdentity,
  normalizeIdentityText,
} from "../src/catalog/identity";

describe("catalog identity", () => {
  it("canonicalizes safe HTTP URLs and removes known tracking variants", () => {
    expect(
      canonicalizeSubjectUrl(
        "https://EXAMPLE.com:443/tools/demo/?utm_source=telegram&b=2&a=1#intro",
      ),
    ).toBe("https://example.com/tools/demo?a=1&b=2");
    expect(canonicalizeSubjectUrl("http://example.com:80/")).toBe(
      "http://example.com/",
    );
  });

  it("rejects unsafe or credential-bearing URLs", () => {
    expect(canonicalizeSubjectUrl("file:///tmp/demo")).toBeNull();
    expect(
      canonicalizeSubjectUrl("https://user:secret@example.com/demo"),
    ).toBeNull();
    expect(canonicalizeSubjectUrl("not a URL")).toBeNull();
  });

  it("uses canonical URLs ahead of names and never merges different URLs", () => {
    const first = deriveCatalogIdentity({
      kind: "PROJECT",
      name: "Demo",
      parentName: null,
      subjectUrl: "https://example.com/demo?utm_medium=social",
    });
    const renamed = deriveCatalogIdentity({
      kind: "TOOL",
      name: "Renamed demo",
      parentName: null,
      subjectUrl: "https://EXAMPLE.com:443/demo/#section",
    });
    const differentUrl = deriveCatalogIdentity({
      kind: "PROJECT",
      name: "Demo",
      parentName: null,
      subjectUrl: "https://example.net/demo",
    });

    expect(first.identityKey).toBe(renamed.identityKey);
    expect(first.identityKey).not.toBe(differentUrl.identityKey);
  });

  it("normalizes Unicode fallback tuples and creates safe slug bases", () => {
    const composed = deriveCatalogIdentity({
      kind: "TOOL",
      name: "Caf\u00e9 Inspector",
      parentName: null,
      subjectUrl: null,
    });
    const decomposed = deriveCatalogIdentity({
      kind: "TOOL",
      name: "Cafe\u0301   Inspector",
      parentName: null,
      subjectUrl: null,
    });

    expect(normalizeIdentityText("  Caf\u00e9---Inspector  ")).toBe(
      "caf\u00e9 inspector",
    );
    expect(composed.identityKey).toBe(decomposed.identityKey);
    expect(composed.slugBase).toBe("cafe-inspector");
    expect(composed.slugSuffix).toHaveLength(12);
  });
});
