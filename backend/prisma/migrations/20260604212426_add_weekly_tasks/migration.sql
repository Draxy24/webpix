-- CreateTable
CREATE TABLE "WeeklyTask" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metric" "AchievementMetric" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "rewardBits" INTEGER NOT NULL DEFAULT 0,
    "rewardCosmeticKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWeeklyTask" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "weeklyTaskId" INTEGER NOT NULL,
    "weekKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserWeeklyTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyTask_key_key" ON "WeeklyTask"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserWeeklyTask_userId_weeklyTaskId_weekKey_key" ON "UserWeeklyTask"("userId", "weeklyTaskId", "weekKey");

-- AddForeignKey
ALTER TABLE "UserWeeklyTask" ADD CONSTRAINT "UserWeeklyTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWeeklyTask" ADD CONSTRAINT "UserWeeklyTask_weeklyTaskId_fkey" FOREIGN KEY ("weeklyTaskId") REFERENCES "WeeklyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
