-- AlterTable
ALTER TABLE "Bull" ADD COLUMN "location" TEXT NOT NULL DEFAULT 'stable';
ALTER TABLE "Bull" ADD COLUMN "denPlotId" INTEGER;

-- AlterTable
ALTER TABLE "PlayerProfile" ADD COLUMN "followingBullIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Existing bulls -> stable
UPDATE "Bull" SET "location" = 'stable' WHERE "location" IS NULL;
