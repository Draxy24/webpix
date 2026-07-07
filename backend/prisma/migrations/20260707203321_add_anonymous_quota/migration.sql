-- CreateTable
CREATE TABLE "AnonymousQuota" (
    "id" TEXT NOT NULL,
    "ip" TEXT,
    "pixelsUsed" INTEGER NOT NULL DEFAULT 0,
    "cooldownUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnonymousQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnonymousQuota_ip_idx" ON "AnonymousQuota"("ip");
