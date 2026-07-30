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

export type Tool = {
  readonly slug: string;
  readonly name: string;
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
