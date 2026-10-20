-- CreateEnum
CREATE TYPE "DoseStatus" AS ENUM ('TAKEN', 'MISSED');

-- CreateEnum
CREATE TYPE "InjectionSite" AS ENUM ('ABDOMEN_LEFT', 'ABDOMEN_RIGHT', 'THIGH_LEFT', 'THIGH_RIGHT', 'ARM_LEFT', 'ARM_RIGHT');

-- CreateEnum
CREATE TYPE "GlucoseSource" AS ENUM ('CSV_UPLOAD', 'CGM_PARTNER', 'SAMPLE');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "MealSource" AS ENUM ('MANUAL', 'PHOTO_AI');

-- CreateEnum
CREATE TYPE "TriageLevel" AS ENUM ('NONE', 'SELF_CARE', 'CONTACT_CLINIC', 'URGENT');

-- CreateEnum
CREATE TYPE "CareAlertKind" AS ENUM ('SEVERE_SYMPTOM', 'PERSISTENT_VOMITING', 'LOW_GLUCOSE', 'SEVERE_LOW_GLUCOSE', 'MISSED_DOSES');

-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_enrollments" (
    "userId" TEXT NOT NULL,
    "clinicId" TEXT,
    "linkedAt" TIMESTAMP(3),
    "drugCode" TEXT NOT NULL,
    "currentDoseMg" DECIMAL(5,2) NOT NULL,
    "doseSince" DATE NOT NULL,
    "startDate" DATE NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "shareWithClinic" BOOLEAN NOT NULL DEFAULT false,
    "allowResearch" BOOLEAN NOT NULL DEFAULT false,
    "allowPharmaStats" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_enrollments_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "dose_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "status" "DoseStatus" NOT NULL,
    "doseMg" DECIMAL(5,2) NOT NULL,
    "site" "InjectionSite",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dose_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glucose_readings" (
    "userId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "mgdl" SMALLINT NOT NULL,
    "source" "GlucoseSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "glucose_readings_pkey" PRIMARY KEY ("userId","measuredAt")
);

-- CreateTable
CREATE TABLE "meal_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eatenAt" TIMESTAMP(3) NOT NULL,
    "mealType" "MealType" NOT NULL,
    "items" JSONB NOT NULL,
    "kcal" INTEGER,
    "carbsG" INTEGER,
    "proteinG" INTEGER,
    "source" "MealSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptom_check_ins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "symptoms" JSONB NOT NULL,
    "redFlags" JSONB NOT NULL,
    "appetite" SMALLINT,
    "weightKg" DECIMAL(5,1),
    "triage" "TriageLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "symptom_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CareAlertKind" NOT NULL,
    "level" "TriageLevel" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "care_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinics_code_key" ON "clinics"("code");

-- CreateIndex
CREATE INDEX "care_enrollments_clinicId_idx" ON "care_enrollments"("clinicId");

-- CreateIndex
CREATE INDEX "dose_logs_userId_takenAt_idx" ON "dose_logs"("userId", "takenAt");

-- CreateIndex
CREATE INDEX "meal_logs_userId_eatenAt_idx" ON "meal_logs"("userId", "eatenAt");

-- CreateIndex
CREATE UNIQUE INDEX "symptom_check_ins_userId_date_key" ON "symptom_check_ins"("userId", "date");

-- CreateIndex
CREATE INDEX "care_alerts_userId_detectedAt_idx" ON "care_alerts"("userId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "care_alerts_userId_kind_dedupeKey_key" ON "care_alerts"("userId", "kind", "dedupeKey");

-- CreateIndex
CREATE INDEX "ai_usages_userId_feature_createdAt_idx" ON "ai_usages"("userId", "feature", "createdAt");

-- AddForeignKey
ALTER TABLE "care_enrollments" ADD CONSTRAINT "care_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_enrollments" ADD CONSTRAINT "care_enrollments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dose_logs" ADD CONSTRAINT "dose_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glucose_readings" ADD CONSTRAINT "glucose_readings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symptom_check_ins" ADD CONSTRAINT "symptom_check_ins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_alerts" ADD CONSTRAINT "care_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
