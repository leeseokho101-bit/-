-- CreateEnum
CREATE TYPE "CoachSpecialty" AS ENUM ('NUTRITION', 'EXERCISE');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('PATIENT', 'COACH', 'SYSTEM');

-- AlterEnum
ALTER TYPE "CareAlertKind" ADD VALUE 'COACH_REFERRAL';

-- AlterTable
ALTER TABLE "care_alerts" ADD COLUMN     "detail" TEXT;

-- AlterTable
ALTER TABLE "care_enrollments" ADD COLUMN     "coachId" TEXT;

-- CreateTable
CREATE TABLE "coaches" (
    "userId" TEXT NOT NULL,
    "specialty" "CoachSpecialty" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coaches_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "coach_messages" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "senderId" TEXT,
    "sender" "MessageSender" NOT NULL,
    "body" TEXT NOT NULL,
    "medicationQuestion" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_access_logs" (
    "id" TEXT NOT NULL,
    "coachUserId" TEXT NOT NULL,
    "patientId" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_messages_patientId_createdAt_idx" ON "coach_messages"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "coach_access_logs_patientId_createdAt_idx" ON "coach_access_logs"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "coach_access_logs_coachUserId_createdAt_idx" ON "coach_access_logs"("coachUserId", "createdAt");

-- CreateIndex
CREATE INDEX "care_enrollments_coachId_idx" ON "care_enrollments"("coachId");

-- AddForeignKey
ALTER TABLE "care_enrollments" ADD CONSTRAINT "care_enrollments_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
