ALTER TABLE "Bull" ADD COLUMN IF NOT EXISTS "rarity" TEXT NOT NULL DEFAULT 'common';

UPDATE "Bull" SET "rarity" = 'legendary' WHERE "trait" = 'ghost' AND "rarity" = 'common';
UPDATE "Bull" SET "rarity" = 'rare' WHERE "trait" = 'rainbow' AND "rarity" = 'common';
