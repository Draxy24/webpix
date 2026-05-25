-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('USER', 'PUBLICATION', 'COMMENT', 'BUG');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "banPermanent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "type" "ReportType" NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "targetUserId" INTEGER,
    "publicationId" INTEGER,
    "commentId" INTEGER,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" INTEGER,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" SERIAL NOT NULL,
    "moderatorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" INTEGER,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);
