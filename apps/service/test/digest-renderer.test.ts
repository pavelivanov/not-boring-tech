import { describe, expect, it } from "vitest";

import {
  DIGEST_VISIBLE_TEXT_LIMIT,
  DigestRendererError,
  renderDigestMessages,
  type DigestRenderInput,
  type DigestSnapshot,
} from "../src/digest/renderer";

const snapshot = (overrides: Partial<DigestSnapshot> = {}): DigestSnapshot => ({
  ordinal: 0,
  slug: "nanochat",
  kind: "PROJECT",
  name: "Nanochat",
  nameRu: "Наночат",
  canonicalUrl: "https://nanochat.example/",
  githubUrl: "https://github.com/karpathy/nanochat",
  githubRepository: "karpathy/nanochat",
  githubStars: 123_456,
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
  it("renders one clean linked-name line without numbering or link metadata", () => {
    const [message] = renderDigestMessages(input());

    expect(message?.renderedHtml).toContain("The weekly project drop 🎉");
    expect(message?.renderedHtml).toContain(
      "A fresh batch of projects, tools, and ideas",
    );
    expect(message?.renderedHtml).toContain(
      '<u>Project</u>\n- <a href="https://nanochat.example/">Nanochat</a> — A compact project',
    );
    expect(message?.renderedHtml).not.toContain(">1</a>");
    expect(message?.renderedHtml).not.toContain(">#</a>");
    expect(message?.renderedHtml).not.toContain(">Link</a>");
    expect(message?.renderedHtml).not.toContain(">GitHub</a>");
    expect(message?.renderedHtml).not.toContain("★");

    const [russian] = renderDigestMessages(input({ language: "RU" }));
    expect(russian?.renderedHtml).toContain("Большая недельная подборка 🎉");
    expect(russian?.renderedHtml).toContain(
      '<u>Проект</u>\n- <a href="https://nanochat.example/">Наночат</a> — Компактный проект',
    );
    expect(russian?.renderedHtml).not.toContain(">Ссылка</a>");
  });

  it("escapes database text and rejects an unsafe project URL", () => {
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

  it("links the project name to its catalog page when external links are absent", () => {
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

    expect(message?.renderedHtml).toContain(
      '<a href="https://findthatproject.com/tools/nanochat">Nanochat</a>',
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

  it("groups ranked items under compact underlined content-type headings", () => {
    const items = [
      snapshot({
        ordinal: 0,
        kind: "SERVICE",
        name: "Hosted Search",
        nameRu: "Облачный поиск",
      }),
      snapshot({
        ordinal: 1,
        kind: "PROJECT",
        name: "Model Lab",
        nameRu: "Лаборатория моделей",
      }),
      snapshot({
        ordinal: 2,
        kind: "SERVICE",
        name: "Code Hosting",
        nameRu: "Хостинг кода",
      }),
    ];
    const [english] = renderDigestMessages(input({ items }));
    const englishHtml = english!.renderedHtml;

    expect(englishHtml.indexOf("<u>Project</u>")).toBeLessThan(
      englishHtml.indexOf("<u>Service</u>"),
    );
    expect(englishHtml.indexOf("Hosted Search")).toBeLessThan(
      englishHtml.indexOf("Code Hosting"),
    );
    expect(englishHtml.match(/<u>Service<\/u>/gu)).toHaveLength(1);
    expect(englishHtml).toContain("<u>Service</u>\n- <a");
    expect(englishHtml).not.toContain("\n\n- <a");

    const [russian] = renderDigestMessages(input({ items, language: "RU" }));
    expect(russian?.renderedHtml).toContain("<u>Проект</u>");
    expect(russian?.renderedHtml).toContain("<u>Сервис</u>");
  });

  it("rebuilds an oversized digest with shorter descriptions as one message", () => {
    const items = Array.from({ length: 20 }, (_, ordinal) =>
      snapshot({
        ordinal,
        slug: `project-${ordinal}`,
        name: `Project ${ordinal}`,
        descriptionEn: `${ordinal}: ${"bounded description ".repeat(21)}`,
      }),
    );
    const messages = renderDigestMessages(input({ items }));

    expect(messages).toHaveLength(1);
    expect(messages[0]?.partIndex).toBe(0);
    expect(messages[0]?.visibleTextLength).toBeLessThanOrEqual(
      DIGEST_VISIBLE_TEXT_LIMIT,
    );
    expect(messages[0]?.renderedHtml).toContain("…");
    for (let ordinal = 0; ordinal < items.length; ordinal += 1) {
      expect(messages[0]?.renderedHtml).toContain(`Project ${ordinal}`);
    }
    expect(messages[0]?.renderedHtml).not.toContain("Part ");
  });

  it("fails safely when even the linked project names cannot fit", () => {
    expect(() =>
      renderDigestMessages(
        input({
          items: [
            snapshot({
              name: "x".repeat(DIGEST_VISIBLE_TEXT_LIMIT),
              descriptionEn: "description",
            }),
          ],
        }),
      ),
    ).toThrowError("DIGEST_MESSAGE_TOO_LARGE");
  });

  it("shows only the digest page link in the footer when items overflow the post", () => {
    const [message] = renderDigestMessages(
      input({
        overflowCount: 18,
        items: [
          snapshot(),
          snapshot({
            ordinal: 1,
            slug: "other",
            name: "Other",
            nameRu: "Другой",
          }),
        ],
      }),
    );
    expect(message?.renderedHtml).toContain(
      '<a href="https://findthatproject.com/digest/latest">See all 20 items from this week →</a>',
    );
    expect(message?.renderedHtml).not.toContain(
      '<a href="https://findthatproject.com/">All projects on FindThatProject →</a>',
    );

    const [russian] = renderDigestMessages(
      input({ language: "RU", overflowCount: 18, items: [snapshot()] }),
    );
    expect(russian?.renderedHtml).toContain(
      '<a href="https://findthatproject.com/digest/latest">Все 19 новинок недели →</a>',
    );
  });
});
