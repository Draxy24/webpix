-- CreateEnum
CREATE TYPE "PrivateSpaceAccess" AS ENUM ('OWNER_ONLY', 'FRIENDS', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('MONTHLY', 'PERMANENT');

-- CreateTable
CREATE TABLE "PrivateSpace" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT,
    "x1" INTEGER NOT NULL,
    "y1" INTEGER NOT NULL,
    "x2" INTEGER NOT NULL,
    "y2" INTEGER NOT NULL,
    "accessMode" "PrivateSpaceAccess" NOT NULL DEFAULT 'OWNER_ONLY',
    "purchaseType" "PurchaseType" NOT NULL,
    "pricePaidCents" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateSpaceMember" (
    "id" SERIAL NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateSpaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivateSpaceMember_spaceId_userId_key" ON "PrivateSpaceMember"("spaceId", "userId");

-- AddForeignKey
ALTER TABLE "PrivateSpace" ADD CONSTRAINT "PrivateSpace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateSpaceMember" ADD CONSTRAINT "PrivateSpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "PrivateSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateSpaceMember" ADD CONSTRAINT "PrivateSpaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
