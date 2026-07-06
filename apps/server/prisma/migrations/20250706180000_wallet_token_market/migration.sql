-- Wallet auth on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "walletAddress" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authNonce" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasDisplayName" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_walletAddress_key" ON "User"("walletAddress");

-- Token marketplace fields on MarketListing
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "reservedById" TEXT;
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "tokenPrice" DECIMAL(20,6);
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "reservedUntil" TIMESTAMP(3);
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "cooldownUntil" TIMESTAMP(3);
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "txSignature" TEXT;
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketListing_txSignature_key" ON "MarketListing"("txSignature");
