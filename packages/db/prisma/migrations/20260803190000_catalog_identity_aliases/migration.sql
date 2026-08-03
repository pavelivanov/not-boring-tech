CREATE TABLE "CatalogIdentityAlias" (
  "identityKey" VARCHAR(69) NOT NULL,
  "catalogItemId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogIdentityAlias_pkey" PRIMARY KEY ("identityKey")
);

CREATE INDEX "CatalogIdentityAlias_catalogItemId_idx"
  ON "CatalogIdentityAlias"("catalogItemId");

ALTER TABLE "CatalogIdentityAlias"
  ADD CONSTRAINT "CatalogIdentityAlias_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
