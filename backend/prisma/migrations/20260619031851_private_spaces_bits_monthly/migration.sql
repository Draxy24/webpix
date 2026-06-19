/*
  Warnings:

  - You are about to drop the column `pricePaidCents` on the `PrivateSpace` table. All the data in the column will be lost.
  - You are about to drop the column `purchaseType` on the `PrivateSpace` table. All the data in the column will be lost.
  - Added the required column `monthlyBits` to the `PrivateSpace` table without a default value. This is not possible if the table is not empty.
  - Made the column `expiresAt` on table `PrivateSpace` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "PrivateSpace" DROP COLUMN "pricePaidCents",
DROP COLUMN "purchaseType",
ADD COLUMN     "monthlyBits" INTEGER NOT NULL,
ALTER COLUMN "expiresAt" SET NOT NULL;

-- DropEnum
DROP TYPE "PurchaseType";
