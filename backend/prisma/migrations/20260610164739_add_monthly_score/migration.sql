-- CreateTable
CREATE TABLE "MonthlyScore" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "pixels" INTEGER NOT NULL DEFAULT 0,
    "creations" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MonthlyScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyScore_userId_period_key" ON "MonthlyScore"("userId", "period");

-- AddForeignKey
ALTER TABLE "MonthlyScore" ADD CONSTRAINT "MonthlyScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
