-- CreateTable
CREATE TABLE "RankingWinner" (
    "id" SERIAL NOT NULL,
    "period" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "country" TEXT,
    "position" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "bitsAwarded" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RankingWinner_period_idx" ON "RankingWinner"("period");

-- CreateIndex
CREATE INDEX "RankingWinner_userId_idx" ON "RankingWinner"("userId");

-- AddForeignKey
ALTER TABLE "RankingWinner" ADD CONSTRAINT "RankingWinner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
