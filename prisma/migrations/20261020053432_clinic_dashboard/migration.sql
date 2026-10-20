-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('DOCTOR', 'NURSE');

-- AlterTable
ALTER TABLE "care_alerts" ADD COLUMN     "acknowledgedBy" TEXT;

-- AlterTable
ALTER TABLE "care_enrollments" ADD COLUMN     "chartNo" TEXT,
ADD COLUMN     "nextVisitOn" DATE;

-- CreateTable
CREATE TABLE "clinic_staff" (
    "userId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'DOCTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_staff_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "clinic_visits" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitedOn" DATE NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_access_logs" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinic_staff_clinicId_idx" ON "clinic_staff"("clinicId");

-- CreateIndex
CREATE INDEX "clinic_visits_patientId_visitedOn_idx" ON "clinic_visits"("patientId", "visitedOn");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_visits_clinicId_patientId_visitedOn_key" ON "clinic_visits"("clinicId", "patientId", "visitedOn");

-- CreateIndex
CREATE INDEX "clinic_access_logs_patientId_createdAt_idx" ON "clinic_access_logs"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "clinic_access_logs_staffUserId_createdAt_idx" ON "clinic_access_logs"("staffUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "clinic_staff" ADD CONSTRAINT "clinic_staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_staff" ADD CONSTRAINT "clinic_staff_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
