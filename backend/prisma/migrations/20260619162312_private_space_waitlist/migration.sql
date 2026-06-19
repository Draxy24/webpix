-- CreateTable
CREATE TABLE "PrivateSpaceWaitlist" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "desiredPixels" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "claimExpiresAt" TIMESTAMP(3),

    CONSTRAINT "PrivateSpaceWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivateSpaceWaitlist_userId_key" ON "PrivateSpaceWaitlist"("userId");

-- AddForeignKey
ALTER TABLE "PrivateSpaceWaitlist" ADD CONSTRAINT "PrivateSpaceWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
