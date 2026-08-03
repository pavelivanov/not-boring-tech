CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE "AnalyzedPostStatus" AS ENUM (
  'PRESENTATIONS_SAVED',
  'NOT_RELEVANT',
  'SKIPPED_NO_TEXT',
  'RETRYABLE_FAILURE',
  'REVIEW_REQUIRED'
);

CREATE TYPE "PresentationKind" AS ENUM (
  'PROJECT',
  'TOOL',
  'LIBRARY',
  'SERVICE',
  'PRODUCT',
  'FEATURE',
  'PLUGIN',
  'SKILL',
  'GUIDE',
  'CHEAT_SHEET',
  'PODCAST',
  'OTHER_TECH'
);

CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

CREATE TABLE "Channel" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "handle" VARCHAR(33) NOT NULL,
  "telegramPeerId" BIGINT,
  "title" VARCHAR(255),
  "publicUrl" VARCHAR(2048) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "incrementalCursorMessageId" BIGINT,
  "backfillBeforeMessageId" BIGINT,
  "backfillCutoffAt" TIMESTAMP(3),
  "backfillCompletedAt" TIMESTAMP(3),
  "lastCollectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyzedPost" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "channelId" UUID NOT NULL,
  "telegramMessageId" BIGINT NOT NULL,
  "sourceUrl" VARCHAR(2048) NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "editedAt" TIMESTAMP(3),
  "contentHash" CHAR(64) NOT NULL,
  "status" "AnalyzedPostStatus" NOT NULL,
  "promptVersion" VARCHAR(80) NOT NULL,
  "schemaVersion" VARCHAR(80) NOT NULL,
  "analysisVersion" VARCHAR(255) NOT NULL,
  "modelId" VARCHAR(120) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "errorClass" VARCHAR(80),
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "openAiRequestId" VARCHAR(160),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyzedPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PresentationCandidate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "analyzedPostId" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "kind" "PresentationKind" NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "parentName" VARCHAR(120),
  "subjectUrl" VARCHAR(2048),
  "descriptionEn" VARCHAR(400) NOT NULL,
  "tags" TEXT[],
  "sourceLanguage" VARCHAR(16) NOT NULL,
  "confidence" DECIMAL(4,3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PresentationCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PresentationCandidate_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 1),
  CONSTRAINT "PresentationCandidate_parent_check" CHECK ("kind" = 'FEATURE' OR "parentName" IS NULL)
);

CREATE TABLE "IngestionRun" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
  "configuredChannelCount" INTEGER NOT NULL,
  "fetchedCount" INTEGER NOT NULL DEFAULT 0,
  "analyzedCount" INTEGER NOT NULL DEFAULT 0,
  "relevantCount" INTEGER NOT NULL DEFAULT 0,
  "presentationsSaved" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "channelOutcomes" JSONB NOT NULL DEFAULT '{}',
  "failureClass" VARCHAR(80),
  "failureSummary" VARCHAR(240),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Channel_handle_key" ON "Channel"("handle");
CREATE UNIQUE INDEX "Channel_telegramPeerId_key" ON "Channel"("telegramPeerId");
CREATE INDEX "Channel_enabled_idx" ON "Channel"("enabled");
CREATE UNIQUE INDEX "AnalyzedPost_channelId_telegramMessageId_key" ON "AnalyzedPost"("channelId", "telegramMessageId");
CREATE INDEX "AnalyzedPost_channelId_status_idx" ON "AnalyzedPost"("channelId", "status");
CREATE INDEX "AnalyzedPost_analysisVersion_idx" ON "AnalyzedPost"("analysisVersion");
CREATE UNIQUE INDEX "PresentationCandidate_analyzedPostId_ordinal_key" ON "PresentationCandidate"("analyzedPostId", "ordinal");
CREATE INDEX "PresentationCandidate_kind_idx" ON "PresentationCandidate"("kind");
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");

ALTER TABLE "AnalyzedPost"
  ADD CONSTRAINT "AnalyzedPost_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PresentationCandidate"
  ADD CONSTRAINT "PresentationCandidate_analyzedPostId_fkey"
  FOREIGN KEY ("analyzedPostId") REFERENCES "AnalyzedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
