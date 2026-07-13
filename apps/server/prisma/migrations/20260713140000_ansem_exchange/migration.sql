-- Ansem gold -> $ANSEM exchange cycles + per-player deposits

CREATE TABLE "AnsemCycle" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "targetGold" INTEGER NOT NULL,
    "tokenUsd" DOUBLE PRECISION NOT NULL,
    "collectedGold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "AnsemCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnsemDeposit" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnsemDeposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnsemDeposit_cycleId_userId_key" ON "AnsemDeposit"("cycleId", "userId");

ALTER TABLE "AnsemDeposit" ADD CONSTRAINT "AnsemDeposit_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AnsemCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnsemDeposit" ADD CONSTRAINT "AnsemDeposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
