DROP INDEX "CatalogItem_lastMentionedAt_id_idx";

CREATE INDEX "CatalogItem_firstMentionedAt_id_idx"
  ON "CatalogItem"("firstMentionedAt", "id");
