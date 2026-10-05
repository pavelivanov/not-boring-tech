import {
  TECHNOLOGY_KINDS,
  type TechnologyKind,
} from "@findthatproject/contracts";

// Telegram accepts up to 4,096 characters after formatting entities are
// parsed. Keep a small buffer and measure the visible text, not the HTML
// markup or hidden link targets.
export const DIGEST_VISIBLE_TEXT_LIMIT = 4_000;

export type DigestLanguage = "EN" | "RU";

export interface DigestSnapshot {
  readonly ordinal: number;
  readonly slug: string;
  readonly kind: TechnologyKind;
  readonly name: string;
  readonly nameRu: string;
  readonly canonicalUrl: string | null;
  readonly githubUrl: string | null;
  readonly githubRepository: string | null;
  readonly githubStars: number | null;
  readonly descriptionEn: string;
  readonly descriptionRu: string;
}

export interface DigestRenderInput {
  readonly windowStart: Date;
  readonly windowEnd: Date;
  readonly items: readonly DigestSnapshot[];
  readonly language: DigestLanguage;
  readonly siteOrigin: string;
  /**
   * Items ranked below the post cut; when positive, the footer links to
   * the digest page on the site for the full list.
   */
  readonly overflowCount?: number;
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
  readonly allItems: (total: number) => string;
  readonly empty: string;
}

const LABELS: Readonly<Record<DigestLanguage, Labels>> = {
  EN: {
    heading: "The weekly project drop 🎉",
    intro:
      "A fresh batch of projects, tools, and ideas we found this week. Everything worth opening is below.",
    catalog: "All projects on FindThatProject →",
    allItems: (total) => `See all ${total} items from this week →`,
    empty: "No new items this week.",
  },
  RU: {
    heading: "Большая недельная подборка 🎉",
    intro:
      "Свежие проекты, инструменты и идеи, которые мы нашли за неделю. Всё самое интересное — ниже.",
    catalog: "Все проекты на FindThatProject →",
    allItems: (total) => `Все ${total} новинок недели →`,
    empty: "На этой неделе новых проектов нет.",
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

const headingFor = (input: DigestRenderInput): RenderedFragment => {
  const labels = LABELS[input.language];
  const details = dateRange(input.windowStart, input.windowEnd, input.language);
  return {
    html: `<b>${escapeHtml(labels.heading)}</b>\n<i>${escapeHtml(details)}</i>\n\n${escapeHtml(labels.intro)}`,
    text: `${labels.heading}\n${details}\n\n${labels.intro}`,
  };
};

const footerFor = (
  input: DigestRenderInput,
  siteOrigin: string,
): RenderedFragment => {
  const labels = LABELS[input.language];
  const overflowCount = input.overflowCount ?? 0;
  if (overflowCount <= 0) return anchor(labels.catalog, siteOrigin);
  return anchor(
    labels.allItems(input.items.length + overflowCount),
    `${siteOrigin}/digest/latest`,
  );
};

const projectUrl = (item: DigestSnapshot, siteOrigin: string): string =>
  safeHttpUrl(
    item.canonicalUrl ??
      item.githubUrl ??
      new URL(`/tools/${encodeURIComponent(item.slug)}`, siteOrigin).href,
  );

const shortenText = (value: string, maximumLength: number): string => {
  if (value.length <= maximumLength) return value;
  if (maximumLength <= 1) return "…";

  let shortened = value.slice(0, maximumLength - 1).trimEnd();
  const finalCodeUnit = shortened.charCodeAt(shortened.length - 1);
  if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) {
    shortened = shortened.slice(0, -1).trimEnd();
  }
  const wordBoundary = shortened.lastIndexOf(" ");
  if (wordBoundary >= Math.floor((maximumLength - 1) * 0.6)) {
    shortened = shortened.slice(0, wordBoundary).trimEnd();
  }
  return `${shortened}…`;
};

const itemBlock = (
  item: DigestSnapshot,
  language: DigestLanguage,
  siteOrigin: string,
  descriptionLimit: number,
): RenderedFragment => {
  const fullDescription =
    language === "EN" ? item.descriptionEn.trim() : item.descriptionRu.trim();
  const name = language === "RU" ? item.nameRu.trim() : item.name.trim();
  if (!name || !fullDescription) {
    throw new DigestRendererError("DIGEST_INVALID_SNAPSHOT");
  }

  const linkedName = anchor(name, projectUrl(item, siteOrigin));
  const description = shortenText(fullDescription, descriptionLimit);
  return {
    html: `${linkedName.html} — ${escapeHtml(description)}`,
    text: `${linkedName.text} — ${description}`,
  };
};

const itemBlocksFor = (
  items: readonly DigestSnapshot[],
  language: DigestLanguage,
  siteOrigin: string,
  descriptionLimit: number,
): readonly RenderedFragment[] =>
  items.map((item) => itemBlock(item, language, siteOrigin, descriptionLimit));

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
  fragment.text.length <= DIGEST_VISIBLE_TEXT_LIMIT;

const renderWithDescriptionLimit = (
  input: DigestRenderInput,
  siteOrigin: string,
  orderedItems: readonly DigestSnapshot[],
  descriptionLimit: number,
): RenderedFragment =>
  combine(
    headingFor(input),
    itemBlocksFor(orderedItems, input.language, siteOrigin, descriptionLimit),
    footerFor(input, siteOrigin),
  );

const fitSingleMessage = (
  input: DigestRenderInput,
  siteOrigin: string,
  orderedItems: readonly DigestSnapshot[],
): RenderedFragment => {
  const descriptions = orderedItems.map((item) =>
    input.language === "EN"
      ? item.descriptionEn.trim()
      : item.descriptionRu.trim(),
  );
  const maximumDescriptionLength = Math.max(
    1,
    ...descriptions.map((description) => description.length),
  );
  const fullMessage = renderWithDescriptionLimit(
    input,
    siteOrigin,
    orderedItems,
    maximumDescriptionLength,
  );
  if (fits(fullMessage)) return fullMessage;

  const minimumMessage = renderWithDescriptionLimit(
    input,
    siteOrigin,
    orderedItems,
    1,
  );
  if (!fits(minimumMessage)) {
    throw new DigestRendererError("DIGEST_MESSAGE_TOO_LARGE");
  }

  // Rebuild the complete message with progressively tighter, equal per-item
  // description caps. Binary search keeps as much copy as the one-message
  // Telegram budget allows while preserving every selected project.
  let lowerBound = 1;
  let upperBound = maximumDescriptionLength - 1;
  let best = minimumMessage;
  while (lowerBound <= upperBound) {
    const candidateLimit = Math.floor((lowerBound + upperBound) / 2);
    const candidate = renderWithDescriptionLimit(
      input,
      siteOrigin,
      orderedItems,
      candidateLimit,
    );
    if (fits(candidate)) {
      best = candidate;
      lowerBound = candidateLimit + 1;
    } else {
      upperBound = candidateLimit - 1;
    }
  }
  return best;
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
  const validKinds = new Set<TechnologyKind>(TECHNOLOGY_KINDS);
  if (orderedItems.some((item) => !validKinds.has(item.kind))) {
    throw new DigestRendererError("DIGEST_INVALID_KIND");
  }

  let message: RenderedFragment;
  if (orderedItems.length === 0) {
    const empty = {
      html: escapeHtml(LABELS[input.language].empty),
      text: LABELS[input.language].empty,
    };
    message = combine(headingFor(input), [empty], footerFor(input, siteOrigin));
    if (!fits(message)) {
      throw new DigestRendererError("DIGEST_MESSAGE_TOO_LARGE");
    }
  } else {
    message = fitSingleMessage(input, siteOrigin, orderedItems);
  }

  return [
    {
      partIndex: 0,
      renderedHtml: message.html,
      visibleTextLength: message.text.length,
    },
  ];
};
