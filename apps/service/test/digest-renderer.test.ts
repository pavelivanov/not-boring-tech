import { describe, expect, it } from "vitest";

import {
  DIGEST_RENDERED_HTML_LIMIT,
  DIGEST_VISIBLE_TEXT_LIMIT,
  DigestRendererError,
  renderDigestMessages,
  type DigestRenderInput,
  type DigestSnapshot,
} from "../src/digest/renderer";

const snapshot = (overrides: Partial<DigestSnapshot> = {}): DigestSnapshot => ({
  ordinal: 0,
  slug: "nanochat",
  name: "Nanochat",
  nameRu: "Наночат",
  canonicalUrl: "https://nanochat.example/",
  githubUrl: "https://github.com/karpathy/nanochat",
  githubRepository: "karpathy/nanochat",
  githubStars: 0,
  descriptionEn: "A compact project for learning how chat models work.",
  descriptionRu: "Компактный проект для изучения диалоговых моделей.",
  ...overrides,
});

const input = (
  overrides: Partial<DigestRenderInput> = {},
): DigestRenderInput => ({
  windowStart: new Date("2026-08-10T09:00:00.000Z"),
  windowEnd: new Date("2026-08-17T09:00:00.000Z"),
  items: [snapshot()],
  language: "EN",
  siteOrigin: "https://findthatproject.com",
  ...overrides,
});

describe("renderDigestMessages", () => {
  it("renders the localized item contract with detail, main, repository, and zero stars", () => {
    const [message] = renderDigestMessages(input());

    expect(message?.renderedHtml).toContain("Weekly FindThatProject digest");
    expect(message?.renderedHtml).toContain(
      'href="https://findthatproject.com/tools/nanochat"',
    );
    expect(message?.renderedHtml).toContain('href="https://nanochat.example/"');
    expect(message?.renderedHtml).toContain(
      'href="https://github.com/karpathy/nanochat"',
    );
    expect(message?.renderedHtml).toContain("★ 0");
    expect(message?.renderedHtml).toContain(
      'href="https://findthatproject.com/"',
    );

    const [russian] = renderDigestMessages(input({ language: "RU" }));
    expect(russian?.renderedHtml).toContain("Еженедельный дайджест");
    expect(russian?.renderedHtml).toContain("1. Наночат");
    expect(russian?.renderedHtml).toContain("Компактный проект для изучения");
    expect(russian?.renderedHtml).toContain("Ссылка на проект");
  });

  it("escapes database text and rejects an unsafe main URL", () => {
    const [message] = renderDigestMessages(
      input({
        items: [
          snapshot({
            name: '<script>alert("name")</script>',
            descriptionEn: "Use A & B's <safe> tool.",
          }),
        ],
      }),
    );

    expect(message?.renderedHtml).not.toContain("<script>");
    expect(message?.renderedHtml).toContain("&lt;script&gt;");
    expect(message?.renderedHtml).toContain("A &amp; B&#39;s &lt;safe&gt;");
    expect(() =>
      renderDigestMessages(
        input({ items: [snapshot({ canonicalUrl: "javascript:alert(1)" })] }),
      ),
    ).toThrowError(DigestRendererError);
  });

  it("uses the detail page as the main-link fallback", () => {
    const [message] = renderDigestMessages(
      input({
        items: [
          snapshot({
            canonicalUrl: null,
            githubUrl: null,
            githubRepository: null,
            githubStars: null,
          }),
        ],
      }),
    );

    expect(
      message?.renderedHtml.match(
        /https:\/\/findthatproject\.com\/tools\/nanochat/g,
      ),
    ).toHaveLength(2);
    expect(message?.renderedHtml).not.toContain("GitHub:");
  });

  it("does not duplicate a repository link that is already the main link", () => {
    const [message] = renderDigestMessages(
      input({
        items: [
          snapshot({
            canonicalUrl: "https://github.com/karpathy/nanochat/",
            githubUrl: "https://github.com/karpathy/nanochat",
            githubStars: 123_456,
          }),
        ],
      }),
    );

    expect(message?.renderedHtml).not.toContain("GitHub:");
    expect(message?.renderedHtml).toContain("★ 123,456");
  });

  it("omits null stars and accepts maximum bounded descriptions", () => {
    const [message] = renderDigestMessages(
      input({
        items: [
          snapshot({ githubStars: null, descriptionEn: "x".repeat(400) }),
        ],
      }),
    );

    expect(message?.renderedHtml).not.toContain("★");
    expect(message?.visibleTextLength).toBeLessThanOrEqual(
      DIGEST_VISIBLE_TEXT_LIMIT,
    );
  });

  it("renders localized empty weeks with the site link", () => {
    for (const language of ["EN", "RU"] as const) {
      const [message] = renderDigestMessages(input({ language, items: [] }));
      expect(message?.renderedHtml).toContain(
        'href="https://findthatproject.com/"',
      );
      expect(message?.renderedHtml).toContain(
        language === "EN"
          ? "No new items this week."
          : "На этой неделе новых проектов нет.",
      );
    }
  });

  it("splits only between items and repeats the heading and site link", () => {
    const items = Array.from({ length: 24 }, (_, ordinal) =>
      snapshot({
        ordinal,
        slug: `project-${ordinal}`,
        name: `Project ${ordinal}`,
        descriptionEn: `${ordinal}: ${"bounded description ".repeat(17)}`,
      }),
    );
    const messages = renderDigestMessages(input({ items }));

    expect(messages.length).toBeGreaterThan(1);
    for (const [index, message] of messages.entries()) {
      expect(message.partIndex).toBe(index);
      expect(message.renderedHtml).toContain(
        `Part ${index + 1}/${messages.length}`,
      );
      expect(message.renderedHtml).toContain(
        'href="https://findthatproject.com/"',
      );
      expect(message.visibleTextLength).toBeLessThanOrEqual(
        DIGEST_VISIBLE_TEXT_LIMIT,
      );
      expect(message.renderedHtml.length).toBeLessThanOrEqual(
        DIGEST_RENDERED_HTML_LIMIT,
      );
    }
    expect(JSON.stringify(messages).match(/Project \d+/g)).toHaveLength(24);
    expect(renderDigestMessages(input({ items }))).toEqual(messages);
  });

  it("fails safely when one indivisible item cannot fit", () => {
    expect(() =>
      renderDigestMessages(
        input({ items: [snapshot({ descriptionEn: "x".repeat(4_000) })] }),
      ),
    ).toThrowError("DIGEST_ITEM_TOO_LARGE");
  });
});
