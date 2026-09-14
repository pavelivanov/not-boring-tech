-- AlterTable
ALTER TABLE "WeeklyDigestRun" ADD COLUMN "selectedCount" INTEGER;

-- BackfillRows
UPDATE "WeeklyDigestRun" SET "selectedCount" = "itemCount" WHERE "selectedCount" IS NULL;
