-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gold" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "hay" INTEGER NOT NULL DEFAULT 6,
    "ore" INTEGER NOT NULL DEFAULT 20,
    "wood" INTEGER NOT NULL DEFAULT 4,
    "stableLevel" INTEGER NOT NULL DEFAULT 1,
    "stableWood" INTEGER NOT NULL DEFAULT 0,
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 33,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 41,
    "helpSeen" BOOLEAN NOT NULL DEFAULT false,
    "betAmount" INTEGER NOT NULL DEFAULT 50,
    "forgeOre" INTEGER NOT NULL DEFAULT 50,
    "listHay" INTEGER NOT NULL DEFAULT 3,
    "listOre" INTEGER NOT NULL DEFAULT 8,
    "listWood" INTEGER NOT NULL DEFAULT 5,
    "breedSel" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "breedingAId" INTEGER,
    "breedingBId" INTEGER,
    "breedingDone" TIMESTAMP(3),
    "nextBullId" INTEGER NOT NULL DEFAULT 2,
    "nextItemId" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bull" (
    "id" SERIAL NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "speed" INTEGER NOT NULL,
    "stamina" INTEGER NOT NULL,
    "accel" INTEGER NOT NULL,
    "temper" INTEGER NOT NULL,
    "energy" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "coat" TEXT NOT NULL,
    CONSTRAINT "Bull_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "rarityColor" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "bonusStat" TEXT,
    "bonusAmt" INTEGER,
    "equippedTo" INTEGER,
    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldNode" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mat" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "deadUntil" TIMESTAMP(3),
    CONSTRAINT "WorldNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "field" JSONB NOT NULL,
    "results" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceEntry" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "userId" TEXT,
    "bullId" INTEGER,
    "isNpc" BOOLEAN NOT NULL DEFAULT false,
    "npcData" JSONB,
    "bullData" JSONB,
    CONSTRAINT "RaceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetBullId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "payout" INTEGER,
    "won" BOOLEAN,
    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "type" TEXT NOT NULL,
    "mat" TEXT,
    "qty" INTEGER,
    "itemData" JSONB,
    "bullData" JSONB,
    "price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),
    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "PlayerProfile_userId_key" ON "PlayerProfile"("userId");

-- AddForeignKey
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bull" ADD CONSTRAINT "Bull_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_equippedTo_fkey" FOREIGN KEY ("equippedTo") REFERENCES "Bull"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_bullId_fkey" FOREIGN KEY ("bullId") REFERENCES "Bull"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
