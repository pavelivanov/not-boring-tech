import {
  canonicalGitHubRepositoryUrl,
  parseGitHubRepositoryUrl,
} from "../github/repository-url";

export const DIGEST_VISIBLE_TEXT_LIMIT = 3_500;
export const DIGEST_RENDERED_HTML_LIMIT = 3_900;

export type DigestLanguage = "EN" | "RU";

export interface DigestSnapshot {
  readonly ordinal: number;
  readonly slug: string;
  readonly name: string;
  readonly nameRu: string;
  readonly canonicalUrl: string | null;
  readonly githubUrl: string | null;
  readonly githubRepository: string | null;
  readonly githubStars: number | null;
  readonly descriptionEn: string;
  readonly descriptionRu: string;
  readonly sourceUrl: string;
}

export interface DigestRenderInput {
  readonly windowStart: Date;
  readonly windowEnd: Date;
  readonly items: readonly DigestSnapshot[];
  readonly language: DigestLanguage;
  readonly siteOrigin: string;
}

export interface RenderedDigestMessage {
  readonly partIndex: number;
  readonly renderedHtml: string;
  readonly visibleTextLength: number;
}

interface RenderedFragment {
  readonly html: string;
  readonly text: string;
}

interface Labels {
  readonly heading: string;
  readonly intro: string;
  readonly catalog: string;
  readonly mainLink: string;
  readonly sourceLink: string;
  readonly empty: string;
  readonly part: (index: number, total: number) => string;
}

const LABELS: Readonly<Record<DigestLanguage, Labels>> = {
  EN: {
    heading: "The weekly project drop 🎉",
    intro:
      "A fresh batch of projects, tools, and ideas we found this week. Everything worth opening is below.",
    catalog: "All projects on FindThatProject →",
    mainLink: "Link",
    sourceLink: "Source",
    empty: "No new items this week.",
    part: (index, total) => `Part ${index}/${total}`,
  },
  RU: {
    heading: "Большая недельная подборка 🎉",
    intro:
      "Свежие проекты, инструменты и идеи, которые мы нашли за неделю. Всё самое интересное — ниже.",
    catalog: "Все проекты на FindThatProject →",
    mainLink: "Ссылка",
    sourceLink: "Источник",
    empty: "На этой неделе новых проектов нет.",
    part: (index, total) => `Часть ${index}/${total}`,
  },
};

export class DigestRendererError extends Error {
  readonly errorClass: string;

  constructor(errorClass: string) {
    super(errorClass);
    this.name = "DigestRendererError";
    this.errorClass = errorClass;
  }
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const safeHttpUrl = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new DigestRendererError("DIGEST_INVALID_URL");
    }
    return url.href;
  } catch (error) {
    if (error instanceof DigestRendererError) throw error;
    throw new DigestRendererError("DIGEST_INVALID_URL");
  }
};

const normalizedSiteOrigin = (value: string): string => {
  const url = new URL(safeHttpUrl(value));
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new DigestRendererError("DIGEST_INVALID_SITE_ORIGIN");
  }
  return url.origin;
};

const anchor = (label: string, url: string): RenderedFragment => ({
  html: `<a href="${escapeHtml(safeHttpUrl(url))}">${escapeHtml(label)}</a>`,
  text: label,
});

const validateDate = (date: Date): Date => {
  if (!Number.isFinite(date.getTime())) {
    throw new DigestRendererError("DIGEST_INVALID_WINDOW");
  }
  return date;
};

const dateRange = (
  start: Date,
  end: Date,
  language: DigestLanguage,
): string => {
  const formatter = new Intl.DateTimeFormat(
    language === "RU" ? "ru-RU" : "en-US",
    { day: "numeric", month: "long", timeZone: "UTC" },
  );
  return formatter.formatRange(validateDate(start), validateDate(end));
};

const headingFor = (
  input: DigestRenderInput,
  siteOrigin: string,
  partIndex?: number,
  partCount?: number,
): RenderedFragment => {
  const labels = LABELS[input.language];
  const details = [
    dateRange(input.windowStart, input.windowEnd, input.language),
  ];
  if (partIndex !== undefined && partCount !== undefined) {
    details.push(labels.part(partIndex, partCount));
  }
  return {
    html: `<b>${escapeHtml(labels.heading)}</b>\n<i>${escapeHtml(details.join(" · "))}</i>\n\n${escapeHtml(labels.intro)}`,
    text: `${labels.heading}\n${details.join(" · ")}\n\n${labels.intro}`,
  };
};

const footerFor = (
  language: DigestLanguage,
  siteOrigin: string,
): RenderedFragment => anchor(LABELS[language].catalog, siteOrigin);

const normalizedComparisonUrl = (value: string): string => {
  const url = new URL(safeHttpUrl(value));
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/u, "");
  return url.href;
};

const starsText = (stars: number, language: DigestLanguage): string => {
  if (!Number.isSafeInteger(stars) || stars < 0) {
    throw new DigestRendererError("DIGEST_INVALID_STARS");
  }
  return `★ ${new Intl.NumberFormat(language === "RU" ? "ru-RU" : "en-US").format(stars)}`;
};

const itemBlock = (
  item: DigestSnapshot,
  language: DigestLanguage,
): RenderedFragment => {
  const labels = LABELS[language];
  const description =
    language === "EN" ? item.descriptionEn.trim() : item.descriptionRu.trim();
  const name = language === "RU" ? item.nameRu.trim() : item.name.trim();
  if (!name || !description) {
    throw new DigestRendererError("DIGEST_INVALID_SNAPSHOT");
  }

  const mainUrl = safeHttpUrl(
    item.canonicalUrl ?? item.githubUrl ?? item.sourceUrl,
  );
  const mainLink = anchor(labels.mainLink, mainUrl);
  const sourceLink = anchor(labels.sourceLink, item.sourceUrl);
  const repositoryUrl = canonicalGitHubRepositoryUrl(
    item.githubUrl ?? item.canonicalUrl,
  );
  const repository =
    repositoryUrl === null ? null : parseGitHubRepositoryUrl(repositoryUrl);
  const sameMainAndRepository =
    repositoryUrl !== null &&
    normalizedComparisonUrl(repositoryUrl) === normalizedComparisonUrl(mainUrl);
  const mainStars =
    sameMainAndRepository && item.githubStars !== null
      ? starsText(item.githubStars, language)
      : null;
  const linkedNumber = anchor(String(item.ordinal + 1), mainUrl);
  const htmlLinks = [
    mainLink.html,
    sourceLink.html,
    ...(mainStars === null ? [] : [escapeHtml(mainStars)]),
  ];
  const textLinks = [
    mainLink.text,
    sourceLink.text,
    ...(mainStars === null ? [] : [mainStars]),
  ];

  const htmlLines = [
    `<b>${linkedNumber.html}</b> <b>${escapeHtml(name)}</b> — ${escapeHtml(description)}`,
  ];
  const textLines = [`${item.ordinal + 1} ${name} — ${description}`];

  if (repositoryUrl !== null && repository !== null && !sameMainAndRepository) {
    const repositoryLink = anchor("GitHub", repositoryUrl);
    htmlLinks.push(repositoryLink.html);
    textLinks.push(repositoryLink.text);
    if (item.githubStars !== null) {
      const stars = starsText(item.githubStars, language);
      htmlLinks.push(escapeHtml(stars));
      textLinks.push(stars);
    }
  }

  htmlLines.push(htmlLinks.join(" • "));
  textLines.push(textLinks.join(" • "));

  return { html: htmlLines.join("\n"), text: textLines.join("\n") };
};

const combine = (
  heading: RenderedFragment,
  blocks: readonly RenderedFragment[],
  footer: RenderedFragment,
): RenderedFragment => {
  const fragments = [heading, ...blocks, footer];
  return {
    html: fragments.map((fragment) => fragment.html).join("\n\n"),
    text: fragments.map((fragment) => fragment.text).join("\n\n"),
  };
};

const fits = (fragment: RenderedFragment): boolean =>
  fragment.text.length <= DIGEST_VISIBLE_TEXT_LIMIT &&
  fragment.html.length <= DIGEST_RENDERED_HTML_LIMIT;

const packForPartCount = (
  input: DigestRenderInput,
  siteOrigin: string,
  blocks: readonly RenderedFragment[],
  assumedPartCount: number,
): readonly (readonly RenderedFragment[])[] => {
  const parts: RenderedFragment[][] = [];
  let current: RenderedFragment[] = [];

  for (const block of blocks) {
    const partIndex = parts.length + 1;
    const heading = headingFor(input, siteOrigin, partIndex, assumedPartCount);
    const footer = footerFor(input.language, siteOrigin);
    if (fits(combine(heading, [...current, block], footer))) {
      current.push(block);
      continue;
    }
    if (current.length === 0) {
      throw new DigestRendererError("DIGEST_ITEM_TOO_LARGE");
    }
    parts.push(current);
    current = [block];
    const nextHeading = headingFor(
      input,
      siteOrigin,
      parts.length + 1,
      assumedPartCount,
    );
    if (!fits(combine(nextHeading, current, footer))) {
      throw new DigestRendererError("DIGEST_ITEM_TOO_LARGE");
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
};

export const renderDigestMessages = (
  input: DigestRenderInput,
): readonly RenderedDigestMessage[] => {
  if (input.windowStart.getTime() >= input.windowEnd.getTime()) {
    throw new DigestRendererError("DIGEST_INVALID_WINDOW");
  }
  const siteOrigin = normalizedSiteOrigin(input.siteOrigin);
  const orderedItems = [...input.items].sort(
    (left, right) => left.ordinal - right.ordinal,
  );
  if (
    orderedItems.some(
      (item, index) => item.ordinal !== index || item.ordinal < 0,
    )
  ) {
    throw new DigestRendererError("DIGEST_INVALID_ORDINALS");
  }

  if (orderedItems.length === 0) {
    const heading = headingFor(input, siteOrigin);
    const footer = footerFor(input.language, siteOrigin);
    const empty = {
      html: escapeHtml(LABELS[input.language].empty),
      text: LABELS[input.language].empty,
    };
    const message = combine(heading, [empty], footer);
    if (!fits(message))
      throw new DigestRendererError("DIGEST_MESSAGE_TOO_LARGE");
    return [
      {
        partIndex: 0,
        renderedHtml: message.html,
        visibleTextLength: message.text.length,
      },
    ];
  }

  const blocks = orderedItems.map((item) => itemBlock(item, input.language));
  const footer = footerFor(input.language, siteOrigin);
  const single = combine(headingFor(input, siteOrigin), blocks, footer);
  if (fits(single)) {
    return [
      {
        partIndex: 0,
        renderedHtml: single.html,
        visibleTextLength: single.text.length,
      },
    ];
  }

  let assumedPartCount = 2;
  let parts: readonly (readonly RenderedFragment[])[] = [];
  for (let attempt = 0; attempt <= blocks.length; attempt += 1) {
    parts = packForPartCount(input, siteOrigin, blocks, assumedPartCount);
    if (parts.length === assumedPartCount) break;
    assumedPartCount = parts.length;
  }
  if (parts.length !== assumedPartCount) {
    throw new DigestRendererError("DIGEST_SPLIT_UNSTABLE");
  }

  return parts.map((part, partIndex) => {
    const message = combine(
      headingFor(input, siteOrigin, partIndex + 1, parts.length),
      part,
      footer,
    );
    if (!fits(message))
      throw new DigestRendererError("DIGEST_MESSAGE_TOO_LARGE");
    return {
      partIndex,
      renderedHtml: message.html,
      visibleTextLength: message.text.length,
    };
  });
};
