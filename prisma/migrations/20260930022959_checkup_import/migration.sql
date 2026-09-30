-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('READ', 'SAVED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DataSource" ADD VALUE 'PHOTO_OCR';
ALTER TYPE "DataSource" ADD VALUE 'NHIS';
ALTER TYPE "DataSource" ADD VALUE 'CHECKUP_CENTER';

-- CreateTable
CREATE TABLE "checkup_imports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "source" "DataSource" NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "errorKind" TEXT,
    "readerVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedAt" TIMESTAMP(3),

    CONSTRAINT "checkup_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkup_imports_userId_createdAt_idx" ON "checkup_imports"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "checkup_imports" ADD CONSTRAINT "checkup_imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_imports" ADD CONSTRAINT "checkup_imports_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
