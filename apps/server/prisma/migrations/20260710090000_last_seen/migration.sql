-- Track last activity for public "players this month" stat
ALTER TABLE "PlayerProfile" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
