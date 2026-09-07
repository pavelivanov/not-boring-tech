ALTER TABLE "WeeklyDigestItem"
  ADD COLUMN "kind" "PresentationKind" NOT NULL DEFAULT 'OTHER_TECH';

UPDATE "WeeklyDigestItem" AS digest_item
SET "kind" = catalog_item."kind"
FROM "CatalogItem" AS catalog_item
WHERE digest_item."catalogItemId" = catalog_item."id";
