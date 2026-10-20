-- CreateEnum
CREATE TYPE "StopReason" AS ENUM ('SIDE_EFFECTS', 'COST', 'GOAL_REACHED', 'DOCTOR_ADVICE', 'INCONVENIENCE', 'OTHER');

-- AlterTable
ALTER TABLE "care_enrollments" ADD COLUMN     "stopReason" "StopReason",
ADD COLUMN     "stoppedAt" DATE;

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "region" TEXT;

-- CreateTable
CREATE TABLE "pharma_orgs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "drugCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharma_orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharma_members" (
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharma_members_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "pharma_access_logs" (
    "id" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharma_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pharma_orgs_name_key" ON "pharma_orgs"("name");

-- CreateIndex
CREATE INDEX "pharma_members_orgId_idx" ON "pharma_members"("orgId");

-- CreateIndex
CREATE INDEX "pharma_access_logs_orgId_createdAt_idx" ON "pharma_access_logs"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "pharma_members" ADD CONSTRAINT "pharma_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharma_members" ADD CONSTRAINT "pharma_members_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "pharma_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
