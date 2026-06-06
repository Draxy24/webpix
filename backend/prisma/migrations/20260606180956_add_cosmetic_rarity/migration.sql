-- CreateEnum
CREATE TYPE "CosmeticRarity" AS ENUM ('COMMON', 'RARE', 'PREMIUM');

-- AlterTable
ALTER TABLE "Cosmetic" ADD COLUMN     "rarity" "CosmeticRarity";
