-- AlterTable
ALTER TABLE "Bull" ADD COLUMN "trait" TEXT NOT NULL DEFAULT 'normal';

-- CreateTable
CREATE TABLE "PasturePlot" (
    "id" INTEGER NOT NULL,
    "ownerId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "woodInvested" INTEGER NOT NULL DEFAULT 0,
    "nextSpawnAt" TIMESTAMP(3),
    "displayBull" JSONB,

    CONSTRAINT "PasturePlot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PasturePlot" ADD CONSTRAINT "PasturePlot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
