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
  readonly catalog: string;
  readonly mainLink: string;
  readonly empty: string;
  readonly part: (index: number, total: number) => string;
}

const LABELS: Readonly<Record<DigestLanguage, Labels>> = {
  EN: {
    heading: "Weekly FindThatProject digest",
    catalog: "Full catalog",
    mainLink: "Project link",
    empty: "No new items this week.",
    part: (index, total) => `Part ${index}/${total}`,
  },
  RU: {
    heading: "Еженедельный дайджест FindThatProject",
    catalog: "Полный каталог",
    mainLink: "Ссылка на проект",
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

const utcDate = (date: Date): string => {
  if (!Number.isFinite(date.getTime())) {
    throw new DigestRendererError("DIGEST_INVALID_WINDOW");
  }
  return date.toISOString().slice(0, 10);
};

const headingFor = (
  input: DigestRenderInput,
  siteOrigin: string,
  partIndex?: number,
  partCount?: number,
): RenderedFragment => {
  const labels = LABELS[input.language];
  const pieces = [
    labels.heading,
    `${utcDate(input.windowStart)}–${utcDate(input.windowEnd)}`,
  ];
  if (partIndex !== undefined && partCount !== undefined) {
    pieces.push(labels.part(partIndex, partCount));
  }
  const heading = pieces.join(" · ");
  const catalog = anchor(labels.catalog, siteOrigin);
  return {
    html: `<b>${escapeHtml(heading)}</b>\n${catalog.html}`,
    text: `${heading}\n${catalog.text}`,
  };
};

const detailUrlFor = (siteOrigin: string, slug: string): string =>
  safeHttpUrl(new URL(`/tools/${encodeURIComponent(slug)}`, siteOrigin).href);

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
  siteOrigin: string,
): RenderedFragment => {
  const labels = LABELS[language];
  const description =
    language === "EN" ? item.descriptionEn.trim() : item.descriptionRu.trim();
  if (!item.name.trim() || !description) {
    throw new DigestRendererError("DIGEST_INVALID_SNAPSHOT");
  }

  const detailUrl = detailUrlFor(siteOrigin, item.slug);
  const detailLink = anchor(
    `${item.ordinal + 1}. ${item.name.trim()}`,
    detailUrl,
  );
  const mainUrl =
    item.canonicalUrl === null ? detailUrl : safeHttpUrl(item.canonicalUrl);
  const mainLink = anchor(labels.mainLink, mainUrl);
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
      ? ` · ${starsText(item.githubStars, language)}`
      : "";

  const htmlLines = [
    `<b>${detailLink.html}</b>`,
    escapeHtml(description),
    `${escapeHtml(labels.mainLink)}: ${mainLink.html}${escapeHtml(mainStars)}`,
  ];
  const textLines = [
    detailLink.text,
    description,
    `${labels.mainLink}: ${mainLink.text}${mainStars}`,
  ];

  if (repositoryUrl !== null && repository !== null && !sameMainAndRepository) {
    const repositoryLink = anchor(repository.fullName, repositoryUrl);
    const stars =
      item.githubStars === null
        ? ""
        : ` · ${starsText(item.githubStars, language)}`;
    htmlLines.push(`GitHub: ${repositoryLink.html}${escapeHtml(stars)}`);
    textLines.push(`GitHub: ${repositoryLink.text}${stars}`);
  }

  return { html: htmlLines.join("\n"), text: textLines.join("\n") };
};

const combine = (
  heading: RenderedFragment,
  blocks: readonly RenderedFragment[],
): RenderedFragment => {
  const fragments = [heading, ...blocks];
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
    if (fits(combine(heading, [...current, block]))) {
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
    if (!fits(combine(nextHeading, current))) {
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
    const empty = {
      html: escapeHtml(LABELS[input.language].empty),
      text: LABELS[input.language].empty,
    };
    const message = combine(heading, [empty]);
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

  const blocks = orderedItems.map((item) =>
    itemBlock(item, input.language, siteOrigin),
  );
  const single = combine(headingFor(input, siteOrigin), blocks);
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
