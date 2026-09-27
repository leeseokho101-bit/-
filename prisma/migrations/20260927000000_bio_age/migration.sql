-- 생체나이: 혈색소 지표, 복용약 성분·알 수, 생체나이 결과
ALTER TYPE "MetricCode" ADD VALUE 'HEMOGLOBIN';

ALTER TABLE "medications" ADD COLUMN "dailyTablets" DECIMAL(4,1);

ALTER TABLE "analysis_results" ADD COLUMN "bioAge" JSONB;
