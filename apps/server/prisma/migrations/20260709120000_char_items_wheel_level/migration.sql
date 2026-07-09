-- Character clothing items, daily wheel, character leveling, hub spawn point

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "equippedChar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'bull';

-- AlterTable
ALTER TABLE "PlayerProfile" ADD COLUMN     "lastWheelSpinAt" TIMESTAMP(3),
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "gold" SET DEFAULT 0,
ALTER COLUMN "posX" SET DEFAULT 28,
ALTER COLUMN "posY" SET DEFAULT 25,
ALTER COLUMN "forgeOre" SET DEFAULT 100,
ALTER COLUMN "listHay" SET DEFAULT 5;
