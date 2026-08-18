ALTER TABLE "PresentationCandidate"
  ADD COLUMN "githubUrl" VARCHAR(2048),
  ADD COLUMN "descriptionRu" VARCHAR(400);

ALTER TABLE "CatalogItem"
  ADD COLUMN "githubUrl" VARCHAR(2048),
  ADD COLUMN "descriptionRu" VARCHAR(400);

CREATE INDEX "CatalogItem_createdAt_id_idx" ON "CatalogItem"("createdAt", "id");

CREATE TYPE "WeeklyDigestRunStatus" AS ENUM (
  'PENDING',
  'PARTIAL',
  'REVIEW_REQUIRED',
  'SUCCEEDED'
);

CREATE TYPE "WeeklyDigestLanguage" AS ENUM ('EN', 'RU');

CREATE TYPE "WeeklyDigestDeliveryStatus" AS ENUM (
  'PENDING',
  'SENDING',
  'SENT',
  'FAILED',
  'REVIEW_REQUIRED'
);

CREATE TABLE "WeeklyDigestRun" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "eligibilityStartAt" TIMESTAMP(3) NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "status" "WeeklyDigestRunStatus" NOT NULL DEFAULT 'PENDING',
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "failureClass" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyDigestRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyDigestRun_window_check" CHECK ("windowStart" < "windowEnd"),
  CONSTRAINT "WeeklyDigestRun_itemCount_check" CHECK ("itemCount" >= 0)
);

CREATE TABLE "WeeklyDigestItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "digestRunId" UUID NOT NULL,
  "catalogItemId" UUID,
  "ordinal" INTEGER NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "canonicalUrl" VARCHAR(2048),
  "githubUrl" VARCHAR(2048),
  "githubRepository" VARCHAR(201),
  "githubStars" INTEGER,
  "descriptionEn" VARCHAR(400) NOT NULL,
  "descriptionRu" VARCHAR(400) NOT NULL,
  "catalogCreatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyDigestItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyDigestItem_ordinal_check" CHECK ("ordinal" >= 0),
  CONSTRAINT "WeeklyDigestItem_githubStars_check" CHECK (
    "githubStars" IS NULL OR "githubStars" >= 0
  )
);

CREATE TABLE "WeeklyDigestDelivery" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "digestRunId" UUID NOT NULL,
  "language" "WeeklyDigestLanguage" NOT NULL,
  "partIndex" INTEGER NOT NULL,
  "targetChatId" VARCHAR(64) NOT NULL,
  "renderedHtml" TEXT NOT NULL,
  "status" "WeeklyDigestDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "telegramMessageId" BIGINT,
  "lastAttemptedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failureClass" VARCHAR(80),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyDigestDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyDigestDelivery_partIndex_check" CHECK ("partIndex" >= 0),
  CONSTRAINT "WeeklyDigestDelivery_attemptCount_check" CHECK ("attemptCount" >= 0),
  CONSTRAINT "WeeklyDigestDelivery_messageId_check" CHECK (
    "telegramMessageId" IS NULL OR "telegramMessageId" > 0
  )
);

CREATE UNIQUE INDEX "WeeklyDigestRun_windowStart_windowEnd_key"
  ON "WeeklyDigestRun"("windowStart", "windowEnd");
CREATE INDEX "WeeklyDigestRun_status_createdAt_idx"
  ON "WeeklyDigestRun"("status", "createdAt");
CREATE INDEX "WeeklyDigestRun_windowEnd_idx" ON "WeeklyDigestRun"("windowEnd");

CREATE UNIQUE INDEX "WeeklyDigestItem_digestRunId_catalogItemId_key"
  ON "WeeklyDigestItem"("digestRunId", "catalogItemId");
CREATE UNIQUE INDEX "WeeklyDigestItem_digestRunId_ordinal_key"
  ON "WeeklyDigestItem"("digestRunId", "ordinal");
CREATE INDEX "WeeklyDigestItem_catalogItemId_idx"
  ON "WeeklyDigestItem"("catalogItemId");
CREATE INDEX "WeeklyDigestItem_catalogCreatedAt_catalogItemId_idx"
  ON "WeeklyDigestItem"("catalogCreatedAt", "catalogItemId");

CREATE UNIQUE INDEX "WeeklyDigestDelivery_digestRunId_language_partIndex_key"
  ON "WeeklyDigestDelivery"("digestRunId", "language", "partIndex");
CREATE INDEX "WeeklyDigestDelivery_digestRunId_status_language_partIndex_idx"
  ON "WeeklyDigestDelivery"("digestRunId", "status", "language", "partIndex");

ALTER TABLE "WeeklyDigestItem"
  ADD CONSTRAINT "WeeklyDigestItem_digestRunId_fkey"
  FOREIGN KEY ("digestRunId") REFERENCES "WeeklyDigestRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyDigestItem"
  ADD CONSTRAINT "WeeklyDigestItem_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WeeklyDigestDelivery"
  ADD CONSTRAINT "WeeklyDigestDelivery_digestRunId_fkey"
  FOREIGN KEY ("digestRunId") REFERENCES "WeeklyDigestRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
