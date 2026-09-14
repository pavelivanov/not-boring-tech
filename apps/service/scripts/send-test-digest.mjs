import { readFileSync } from "node:fs";

import { technologyKindSchema } from "@findthatproject/contracts";

import { rankDigestItems } from "../src/digest/ranking.ts";
import { renderDigestMessages } from "../src/digest/renderer.ts";
import { TelegramBotApiClient } from "../src/digest/telegram-bot-client.ts";

const data = JSON.parse(readFileSync("/tmp/digest-test-data.json", "utf8"));
const chatId = "@FindThatProjectTestChannel";
const siteOrigin = "https://findthatproject.com";
const coverUrl = `${siteOrigin}/weekly-digest-cover.png`;
const token = process.env.TELEGRAM_DIGEST_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_DIGEST_BOT_TOKEN is required");

// The Sep-7 run predates mention-stat collection; use catalogCreatedAt as the
// recency signal and treat every item as single-mention, which matches the
// production data for that week (27 of 28 items had exactly one mention).
const rankable = data.items.map((item) => ({
  id: item.catalogItemId ?? item.slug,
  kind: technologyKindSchema.parse(item.kind),
  githubStars: item.githubStars,
  lastMentionedAt: new Date(item.catalogCreatedAt),
  mentionCount: 1,
  channelCount: 1,
}));
const ranking = rankDigestItems(rankable, 10);
const byId = new Map(
  data.items.map((item) => [item.catalogItemId ?? item.slug, item]),
);
const snapshots = [...ranking.selected, ...ranking.overflow]
  .map((ranked, ordinal) => {
    const item = byId.get(ranked.id);
    return {
      ordinal,
      slug: item.slug,
      kind: technologyKindSchema.parse(item.kind),
      name: item.name,
      nameRu: item.nameRu,
      canonicalUrl: item.canonicalUrl,
      githubUrl: item.githubUrl,
      githubRepository: item.githubRepository,
      githubStars: item.githubStars,
      descriptionEn: item.descriptionEn,
      descriptionRu: item.descriptionRu,
      sourceUrl: `${siteOrigin}/digest/latest`,
    };
  })
  .slice(0, ranking.selected.length);
const overflowCount = data.items.length - ranking.selected.length;

const input = {
  windowStart: new Date(data.run.windowStart),
  windowEnd: new Date(data.run.windowEnd),
  items: snapshots,
  overflowCount,
  siteOrigin,
};

const client = new TelegramBotApiClient({
  token,
  requestTimeoutMs: 15_000,
  maxAttempts: 3,
});

console.log(
  `selected ${ranking.selected.length} of ${data.items.length}; overflow ${overflowCount}`,
);
console.log("order:", snapshots.map((item) => item.slug).join(", "));

await client.sendPhoto({ chatId, photoUrl: coverUrl });
for (const language of ["EN", "RU"]) {
  const messages = renderDigestMessages({ ...input, language });
  for (const message of messages) {
    const sent = await client.sendMessage({
      chatId,
      html: message.renderedHtml,
    });
    console.log(
      `${language} part ${message.partIndex}: message ${sent.messageId}`,
    );
  }
}
