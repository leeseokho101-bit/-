import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeCheckup } from "@/domain/checkup-import/normalize";
import {
  PHOTO_MAX_BYTES,
  photoReadToRaw,
  sniffImageType,
} from "@/domain/checkup-import/photo";
import type {
  ImportableCode,
  ImportSource,
  ImportWarning,
} from "@/domain/checkup-import/types";
import {
  calculateBmi,
  isWithinInputRange,
  METRICS,
} from "@/domain/health-snapshot/metrics";
import type { CheckupPhotoReader } from "@/server/ai/checkup-reader";
import { LlmProviderError } from "@/server/ai/provider";
import { logger } from "@/server/logger";

type Tx = Prisma.TransactionClient;

/** 사용자당 24시간 사진 판독 횟수 (AI 비용·오남용 방지) */
export const PHOTO_DAILY_LIMIT = 10;

export type ImportedValues = {
  checkupDate?: string;
  values: Partial<Record<ImportableCode, number>>;
};

/**
 * 가져온 검진 값 저장 (사진 판독·외부 연동 공통).
 * - 가져온 항목만 덮어쓰고, 없는 항목은 지우지 않는다 (직접 입력한 값 보존)
 * - 키·체중이 바뀌면 BMI를 다시 계산한다
 */
export async function applyImportedCheckup(
  tx: Tx,
  assessmentId: string,
  data: ImportedValues,
  source: ImportSource,
): Promise<void> {
  if (data.checkupDate) {
    await tx.assessment.update({
      where: { id: assessmentId },
      data: { checkupDate: new Date(`${data.checkupDate}T00:00:00Z`) },
    });
  }
  for (const [metric, value] of Object.entries(data.values) as [
    ImportableCode,
    number,
  ][]) {
    const row = { value, unit: METRICS[metric].unit, source };
    await tx.measurement.upsert({
      where: { assessmentId_metric: { assessmentId, metric } },
      create: { assessmentId, metric, ...row },
      update: row,
    });
  }
  if (data.values.HEIGHT !== undefined || data.values.WEIGHT !== undefined) {
    const body = await tx.measurement.findMany({
      where: { assessmentId, metric: { in: ["HEIGHT", "WEIGHT"] } },
      select: { metric: true, value: true },
    });
    const get = (m: string) => Number(body.find((b) => b.metric === m)?.value);
    const bmi = calculateBmi(get("HEIGHT"), get("WEIGHT"));
    if (bmi !== null && isWithinInputRange("BMI", bmi)) {
      const row = { value: bmi, unit: METRICS.BMI.unit, source };
      await tx.measurement.upsert({
        where: { assessmentId_metric: { assessmentId, metric: "BMI" } },
        create: { assessmentId, metric: "BMI", ...row },
        update: row,
      });
    }
  }
}

export type PhotoReadFailure =
  | "too-large"
  | "not-image"
  | "daily-limit"
  | "not-checkup"
  | "no-values"
  | "failed";

export type PhotoReadResult =
  | {
      ok: true;
      importId: string;
      checkupDate?: string;
      values: Partial<Record<ImportableCode, number>>;
      warnings: ImportWarning[];
    }
  | { ok: false; reason: PhotoReadFailure };

/**
 * 결과표 사진 판독: 형식·크기·횟수 확인 → AI 판독 → 공통 검증.
 * 사진은 메모리에서만 쓰고 저장·로그하지 않는다. 결과는 저장하지 않고 확인 화면으로 돌려준다.
 */
export async function readCheckupPhoto(
  deps: { db: PrismaClient; reader: CheckupPhotoReader; now?: Date },
  input: { userId: string; assessmentId: string; bytes: Uint8Array },
): Promise<PhotoReadResult> {
  const { db, reader } = deps;
  const now = deps.now ?? new Date();
  if (input.bytes.byteLength > PHOTO_MAX_BYTES)
    return { ok: false, reason: "too-large" };
  const mediaType = sniffImageType(input.bytes);
  if (!mediaType) return { ok: false, reason: "not-image" };

  const recent = await db.checkupImport.count({
    where: {
      userId: input.userId,
      source: "PHOTO_OCR",
      createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recent >= PHOTO_DAILY_LIMIT) return { ok: false, reason: "daily-limit" };

  const record = (data: {
    status: "READ" | "FAILED";
    itemCount?: number;
    errorKind?: string;
  }) =>
    db.checkupImport.create({
      data: {
        userId: input.userId,
        assessmentId: input.assessmentId,
        source: "PHOTO_OCR",
        readerVersion: reader.version,
        ...data,
      },
      select: { id: true },
    });

  let read;
  try {
    read = await reader.read({ data: input.bytes, mediaType });
  } catch (error) {
    const kind = error instanceof LlmProviderError ? error.kind : "unknown";
    await record({ status: "FAILED", errorKind: kind });
    logger.warn("checkup photo read failed", {
      userId: input.userId,
      kind,
    });
    return { ok: false, reason: "failed" };
  }
  if (!read.isCheckupResult) {
    await record({ status: "FAILED", errorKind: "not-checkup" });
    return { ok: false, reason: "not-checkup" };
  }

  const normalized = normalizeCheckup(photoReadToRaw(read), now);
  const itemCount = Object.keys(normalized.values).length;
  if (itemCount === 0) {
    await record({ status: "FAILED", errorKind: "no-values" });
    return { ok: false, reason: "no-values" };
  }
  const { id } = await record({ status: "READ", itemCount });
  logger.info("checkup photo read", { userId: input.userId, itemCount });
  return { ok: true, importId: id, ...normalized };
}

/** 확인 화면에서 저장. 판독 기록이 본인·같은 분석의 미저장 건일 때만 허용 */
export async function saveConfirmedImport(
  tx: Tx,
  input: {
    userId: string;
    assessmentId: string;
    importId: string;
    data: ImportedValues;
  },
): Promise<boolean> {
  const updated = await tx.checkupImport.updateMany({
    where: {
      id: input.importId,
      userId: input.userId,
      assessmentId: input.assessmentId,
      status: "READ",
    },
    data: {
      status: "SAVED",
      savedAt: new Date(),
      itemCount: Object.keys(input.data.values).length,
    },
  });
  if (updated.count !== 1) return false;
  await applyImportedCheckup(tx, input.assessmentId, input.data, "PHOTO_OCR");
  return true;
}
