import { createHash } from "node:crypto";

import type { TechnologyKind } from "@techdex/contracts";

const TRACKING_PARAMETERS = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "msclkid",
]);

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const normalizeIdentityText = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");

export const normalizeTag = (value: string): string =>
  value.normalize("NFKC").toLocaleLowerCase("en").trim().replace(/\s+/gu, " ");

const isTrackingParameter = (name: string): boolean => {
  const normalized = name.toLocaleLowerCase("en");
  return normalized.startsWith("utm_") || TRACKING_PARAMETERS.has(normalized);
};

export const canonicalizeSubjectUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return null;
    }

    url.hash = "";
    for (const name of [...url.searchParams.keys()]) {
      if (isTrackingParameter(name)) url.searchParams.delete(name);
    }
    const sortedParameters = [...url.searchParams.entries()].sort(
      ([leftName, leftValue], [rightName, rightValue]) =>
        leftName.localeCompare(rightName) ||
        leftValue.localeCompare(rightValue),
    );
    url.search = "";
    for (const [name, parameterValue] of sortedParameters) {
      url.searchParams.append(name, parameterValue);
    }
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/u, "");
    }
    return url.href;
  } catch {
    return null;
  }
};

const slugBaseForName = (name: string): string => {
  const asciiSlug = name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 140)
    .replace(/-+$/u, "");
  return asciiSlug || "catalog-item";
};

export interface CatalogIdentity {
  readonly identityKey: string;
  readonly identityKeys: readonly string[];
  readonly canonicalUrl: string | null;
  readonly nameSortKey: string;
  readonly slugBase: string;
  readonly slugSuffix: string;
}

export const deriveCatalogIdentity = (input: {
  readonly kind: TechnologyKind;
  readonly name: string;
  readonly parentName: string | null;
  readonly subjectUrl: string | null;
}): CatalogIdentity => {
  const canonicalUrl =
    input.subjectUrl === null ? null : canonicalizeSubjectUrl(input.subjectUrl);
  const nameIdentityKey = `name:${sha256(
    JSON.stringify([
      normalizeIdentityText(input.parentName ?? ""),
      normalizeIdentityText(input.name),
    ]),
  )}`;
  const urlIdentityKey =
    canonicalUrl === null ? null : `url:${sha256(canonicalUrl)}`;
  const identityKey = urlIdentityKey ?? nameIdentityKey;
  const digest = identityKey.slice(identityKey.indexOf(":") + 1);

  return {
    identityKey,
    identityKeys:
      urlIdentityKey === null
        ? [nameIdentityKey]
        : [urlIdentityKey, nameIdentityKey],
    canonicalUrl,
    nameSortKey: normalizeIdentityText(input.name),
    slugBase: slugBaseForName(input.name),
    slugSuffix: digest.slice(0, 12),
  };
};
