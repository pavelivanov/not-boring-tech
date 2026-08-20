ALTER TABLE "CatalogItem"
ADD COLUMN "nameRu" VARCHAR(120),
ADD COLUMN "parentNameRu" VARCHAR(120);

ALTER TABLE "PresentationCandidate"
ADD COLUMN "nameRu" VARCHAR(120),
ADD COLUMN "parentNameRu" VARCHAR(120);

ALTER TABLE "WeeklyDigestItem"
ADD COLUMN "nameRu" VARCHAR(120);

UPDATE "CatalogItem"
SET "nameRu" = "name"
WHERE "nameRu" IS NULL;

UPDATE "PresentationCandidate"
SET "nameRu" = "name"
WHERE "nameRu" IS NULL;

UPDATE "WeeklyDigestItem"
SET "nameRu" = "name"
WHERE "nameRu" IS NULL;

ALTER TABLE "CatalogItem"
ALTER COLUMN "nameRu" SET NOT NULL;

ALTER TABLE "PresentationCandidate"
ALTER COLUMN "nameRu" SET NOT NULL;

ALTER TABLE "WeeklyDigestItem"
ALTER COLUMN "nameRu" SET NOT NULL;
