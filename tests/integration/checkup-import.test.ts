import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoRead } from "@/domain/checkup-import/photo";
import {
  PHOTO_DAILY_LIMIT,
  readCheckupPhoto,
  saveConfirmedImport,
} from "@/features/checkup-import/service";
import type { CheckupPhotoReader } from "@/server/ai/checkup-reader";
import { LlmProviderError } from "@/server/ai/provider";

if (process.env.NODE_ENV === "production") {
  throw new Error("DB integration tests must not run in production");
}

const db = new PrismaClient();
// 테스트 전용 가상 계정 (실제 개인정보 아님)
const EMAIL = "checkup-import-test@example.invalid";
const OTHER_EMAIL = "checkup-import-other@example.invalid";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const NOW = new Date("2026-09-30T03:00:00Z");

function fakeReader(
  impl: () => Promise<PhotoRead>,
): CheckupPhotoReader & { read: ReturnType<typeof vi.fn> } {
  return { model: "fake", version: "fake-v1", read: vi.fn(impl) };
}

const goodRead: PhotoRead = {
  isCheckupResult: true,
  checkupDate: "2026-03-15",
  items: [
    { metric: "HEIGHT", value: 170, unit: "cm" },
    { metric: "WEIGHT", value: 80, unit: "kg" },
    { metric: "LDL", value: 150, unit: "mg/dL" },
    { metric: "FASTING_GLUCOSE", value: 5.5, unit: "mmol/L" },
  ],
};

let userId: string;
let assessmentId: string;

async function cleanup() {
  await db.user.deleteMany({ where: { email: { in: [EMAIL, OTHER_EMAIL] } } });
}

beforeEach(async () => {
  await cleanup();
  const user = await db.user.create({
    data: {
      email: EMAIL,
      displayName: "테스트",
      isSample: true,
      assessments: {
        create: {
          measurements: {
            create: [
              { metric: "HEIGHT", value: 160, unit: "cm" },
              { metric: "WEIGHT", value: 60, unit: "kg" },
              { metric: "BMI", value: 23.4, unit: "kg/m²" },
              { metric: "HDL", value: 55, unit: "mg/dL" },
            ],
          },
        },
      },
    },
    include: { assessments: true },
  });
  userId = user.id;
  assessmentId = user.assessments[0].id;
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

const read = (reader: CheckupPhotoReader, bytes = JPEG) =>
  readCheckupPhoto({ db, reader, now: NOW }, { userId, assessmentId, bytes });

describe("readCheckupPhoto", () => {
  it("판독 결과를 검증해 돌려주고, 값은 저장하지 않는다", async () => {
    const reader = fakeReader(async () => goodRead);
    const result = await read(reader);
    expect(result).toMatchObject({
      ok: true,
      checkupDate: "2026-03-15",
      values: { HEIGHT: 170, WEIGHT: 80, LDL: 150, FASTING_GLUCOSE: 99 },
    });
    expect(reader.read).toHaveBeenCalledWith({
      data: JPEG,
      mediaType: "image/jpeg",
    });
    const log = await db.checkupImport.findMany({ where: { userId } });
    expect(log).toMatchObject([
      {
        status: "READ",
        itemCount: 4,
        source: "PHOTO_OCR",
        readerVersion: "fake-v1",
      },
    ]);
    // 확인 전이라 측정값은 그대로
    const ldl = await db.measurement.findFirst({
      where: { assessmentId, metric: "LDL" },
    });
    expect(ldl).toBeNull();
  });

  it("이미지가 아니면 AI를 호출하지 않는다", async () => {
    const reader = fakeReader(async () => goodRead);
    const result = await read(reader, new TextEncoder().encode("%PDF-1.7"));
    expect(result).toEqual({ ok: false, reason: "not-image" });
    expect(reader.read).not.toHaveBeenCalled();
  });

  it("하루 판독 횟수를 넘으면 거절한다", async () => {
    await db.checkupImport.createMany({
      data: Array.from({ length: PHOTO_DAILY_LIMIT }, () => ({
        userId,
        source: "PHOTO_OCR" as const,
        status: "FAILED" as const,
        createdAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      })),
    });
    const reader = fakeReader(async () => goodRead);
    expect(await read(reader)).toEqual({ ok: false, reason: "daily-limit" });
    expect(reader.read).not.toHaveBeenCalled();
  });

  it("결과표가 아니거나 AI 오류면 실패로 기록한다", async () => {
    expect(
      await read(
        fakeReader(async () => ({
          isCheckupResult: false,
          checkupDate: null,
          items: [],
        })),
      ),
    ).toEqual({ ok: false, reason: "not-checkup" });
    expect(
      await read(
        fakeReader(async () => {
          throw new LlmProviderError("refusal", "refused");
        }),
      ),
    ).toEqual({ ok: false, reason: "failed" });
    expect(
      await read(
        fakeReader(async () => ({
          isCheckupResult: true,
          checkupDate: null,
          items: [{ metric: "LDL", value: 99999, unit: "mg/dL" }],
        })),
      ),
    ).toEqual({ ok: false, reason: "no-values" });
    const kinds = await db.checkupImport.findMany({
      where: { userId },
      select: { status: true, errorKind: true },
      orderBy: { createdAt: "asc" },
    });
    expect(kinds).toEqual([
      { status: "FAILED", errorKind: "not-checkup" },
      { status: "FAILED", errorKind: "refusal: refused" },
      { status: "FAILED", errorKind: "no-values" },
    ]);
  });
});

describe("saveConfirmedImport", () => {
  async function readOnce() {
    const r = await read(fakeReader(async () => goodRead));
    if (!r.ok) throw new Error("read failed");
    return r;
  }

  it("확인한 값만 출처와 함께 저장하고, BMI를 다시 계산하며, 다른 값은 보존한다", async () => {
    const r = await readOnce();
    const ok = await db.$transaction((tx) =>
      saveConfirmedImport(tx, {
        userId,
        assessmentId,
        importId: r.importId,
        data: {
          checkupDate: "2026-03-15",
          values: { HEIGHT: 170, WEIGHT: 80, LDL: 150 },
        },
      }),
    );
    expect(ok).toBe(true);
    const rows = await db.measurement.findMany({
      where: { assessmentId },
      select: { metric: true, value: true, source: true },
    });
    const by = Object.fromEntries(
      rows.map((r) => [r.metric, { value: Number(r.value), source: r.source }]),
    );
    expect(by).toEqual({
      HEIGHT: { value: 170, source: "PHOTO_OCR" },
      WEIGHT: { value: 80, source: "PHOTO_OCR" },
      BMI: { value: 27.7, source: "PHOTO_OCR" },
      LDL: { value: 150, source: "PHOTO_OCR" },
      HDL: { value: 55, source: "MANUAL" },
    });
    const a = await db.assessment.findUniqueOrThrow({
      where: { id: assessmentId },
    });
    expect(a.checkupDate?.toISOString().slice(0, 10)).toBe("2026-03-15");
    const log = await db.checkupImport.findUniqueOrThrow({
      where: { id: r.importId },
    });
    expect(log).toMatchObject({ status: "SAVED", itemCount: 3 });
  });

  it("같은 판독 결과는 한 번만, 본인 것만 저장할 수 있다", async () => {
    const r = await readOnce();
    const other = await db.user.create({
      data: {
        email: OTHER_EMAIL,
        displayName: "다른 사용자",
        isSample: true,
        assessments: { create: {} },
      },
      include: { assessments: true },
    });
    const save = (uid: string, aid: string) =>
      db.$transaction((tx) =>
        saveConfirmedImport(tx, {
          userId: uid,
          assessmentId: aid,
          importId: r.importId,
          data: { values: { LDL: 150 } },
        }),
      );
    expect(await save(other.id, other.assessments[0].id)).toBe(false);
    expect(await save(userId, assessmentId)).toBe(true);
    expect(await save(userId, assessmentId)).toBe(false);
  });

  it("회원 삭제 시 판독 기록도 함께 삭제된다", async () => {
    await readOnce();
    await db.user.delete({ where: { id: userId } });
    expect(await db.checkupImport.count({ where: { userId } })).toBe(0);
  });
});
