CREATE EXTENSION IF NOT EXISTS "pg_trgm";

ALTER TABLE "PresentationCandidate"
  ADD COLUMN "category" VARCHAR(40) NOT NULL DEFAULT 'Other',
  ADD COLUMN "catalogItemId" UUID;

ALTER TABLE "PresentationCandidate"
  ADD CONSTRAINT "PresentationCandidate_category_check"
  CHECK (
    "category" IN (
      'AI development',
      'AI productivity',
      'Creative AI',
      'Data systems',
      'Design',
      'Developer tools',
      'Frontend',
      'Infrastructure',
      'Learning resources',
      'Operations',
      'Security',
      'Other'
    )
  );

CREATE TABLE "CatalogItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identityKey" VARCHAR(69) NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "kind" "PresentationKind" NOT NULL,
  "category" VARCHAR(40) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "nameSortKey" VARCHAR(240) NOT NULL,
  "parentName" VARCHAR(120),
  "canonicalUrl" VARCHAR(2048),
  "descriptionEn" VARCHAR(400) NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "searchText" TEXT NOT NULL,
  "firstMentionedAt" TIMESTAMP(3) NOT NULL,
  "lastMentionedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CatalogItem_category_check"
    CHECK (
      "category" IN (
        'AI development',
        'AI productivity',
        'Creative AI',
        'Data systems',
        'Design',
        'Developer tools',
        'Frontend',
        'Infrastructure',
        'Learning resources',
        'Operations',
        'Security',
        'Other'
      )
    )
);

CREATE UNIQUE INDEX "CatalogItem_identityKey_key" ON "CatalogItem"("identityKey");
CREATE UNIQUE INDEX "CatalogItem_slug_key" ON "CatalogItem"("slug");
CREATE INDEX "CatalogItem_lastMentionedAt_id_idx" ON "CatalogItem"("lastMentionedAt", "id");
CREATE INDEX "CatalogItem_nameSortKey_id_idx" ON "CatalogItem"("nameSortKey", "id");
CREATE INDEX "CatalogItem_kind_idx" ON "CatalogItem"("kind");
CREATE INDEX "CatalogItem_category_idx" ON "CatalogItem"("category");
CREATE INDEX "CatalogItem_tags_idx" ON "CatalogItem" USING GIN ("tags");
CREATE INDEX "CatalogItem_searchText_trgm_idx" ON "CatalogItem" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "PresentationCandidate_category_idx" ON "PresentationCandidate"("category");
CREATE INDEX "PresentationCandidate_catalogItemId_idx" ON "PresentationCandidate"("catalogItemId");

ALTER TABLE "PresentationCandidate"
  ADD CONSTRAINT "PresentationCandidate_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
