ALTER TABLE "CatalogItem"
  ADD COLUMN "githubRepository" VARCHAR(201),
  ADD COLUMN "githubStars" INTEGER,
  ADD COLUMN "githubStarsFetchedAt" TIMESTAMP(3),
  ADD COLUMN "githubEtag" VARCHAR(255);

ALTER TABLE "CatalogItem"
  ADD CONSTRAINT "CatalogItem_githubStars_check"
  CHECK ("githubStars" IS NULL OR "githubStars" >= 0);
