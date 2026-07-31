export type Channel = {
  readonly id: string;
  readonly name: string;
  readonly publicUrl: string;
};

export type Mention = {
  readonly channelId: string;
  readonly sourceUrl: string;
  readonly publishedAt: string;
  readonly collectedAt: string;
};

export type TechnologyKind =
  | "TOOL"
  | "PROJECT"
  | "LIBRARY"
  | "SERVICE"
  | "PRODUCT"
  | "FEATURE"
  | "PLUGIN"
  | "SKILL"
  | "GUIDE"
  | "CHEAT_SHEET"
  | "PODCAST"
  | "OTHER_TECH";

export type Tool = {
  readonly slug: string;
  readonly name: string;
  readonly kind: TechnologyKind;
  readonly parentName?: string;
  readonly canonicalUrl: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly mentions: readonly Mention[];
};

export type RetrievalEvalCase = {
  readonly query: string;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly expectedToolSlugs: readonly string[];
};
