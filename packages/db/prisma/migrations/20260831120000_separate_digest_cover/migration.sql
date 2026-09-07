CREATE TYPE "WeeklyDigestDeliveryKind" AS ENUM ('TEXT', 'PHOTO');

ALTER TABLE "WeeklyDigestDelivery"
  ADD COLUMN "kind" "WeeklyDigestDeliveryKind" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN "mediaUrl" VARCHAR(2048);

ALTER TABLE "WeeklyDigestDelivery"
  ADD CONSTRAINT "WeeklyDigestDelivery_payload_check" CHECK (
    ("kind" = 'TEXT' AND "mediaUrl" IS NULL)
    OR ("kind" = 'PHOTO' AND "mediaUrl" IS NOT NULL)
  );
