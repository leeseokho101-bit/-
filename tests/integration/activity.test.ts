import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sampleUsers } from "@/dev/samples";
import { resetSampleUser } from "@/dev/seed-sample";
import { addDays } from "@/features/activity/date";
import {
  getActivityOverview,
  listActivityLogs,
  saveActivityLog,
} from "@/features/activity/service";
import { runAnalysis } from "@/features/analysis/run";

if (process.env.NODE_ENV === "production") {
  throw new Error("DB integration tests must not run in production");
}

const db = new PrismaClient();
// 테스트 전용 가상 계정 (실제 개인정보 아님)
const EMAIL = "activity-test@example.invalid";
const sample = { ...sampleUsers.find((s) => s.id === "C")!, email: EMAIL };
const TODAY = "2026-10-19";
let userId: string;

beforeAll(async () => {
  userId = await resetSampleUser(db, sample, "scrypt$x$y");
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL, isSample: true } });
  await db.$disconnect();
});

describe("활동 기록 (DB)", () => {
  it("하루 한 건으로 저장·덮어쓰기하고, 모두 비우면 지운다", async () => {
    await saveActivityLog(db, userId, {
      date: TODAY,
      steps: 6000,
      sessions: [],
    });
    await saveActivityLog(db, userId, {
      date: TODAY,
      steps: 9000,
      sessions: [{ type: "CYCLING", intensity: "MODERATE", minutes: 30 }],
    });
    expect(await listActivityLogs(db, userId, TODAY, 7)).toEqual([
      {
        date: TODAY,
        steps: 9000,
        sessions: [{ type: "CYCLING", intensity: "MODERATE", minutes: 30 }],
      },
    ]);
    expect(
      await saveActivityLog(db, userId, { date: TODAY, sessions: [] }),
    ).toBe("deleted");
    expect(await listActivityLogs(db, userId, TODAY, 7)).toEqual([]);
  });

  it("분석 결과가 없으면 기록만, 있으면 예상 생체나이를 함께 돌려준다", async () => {
    for (let i = 0; i < 28; i++)
      await saveActivityLog(db, userId, {
        date: addDays(TODAY, -i),
        steps: 9000,
        sessions: [{ type: "RUNNING", intensity: "VIGOROUS", minutes: 20 }],
      });
    // 기간 밖(12주 이전) 기록은 쓰지 않는다
    await saveActivityLog(db, userId, {
      date: addDays(TODAY, -100),
      steps: 30000,
      sessions: [],
    });

    const before = await getActivityOverview(db, userId, TODAY);
    expect(before.logs).toHaveLength(28);
    expect(before.projection).toBeNull();

    const { id } = await db.assessment.findFirstOrThrow({ where: { userId } });
    await runAnalysis(db, id);
    const after = await getActivityOverview(db, userId, TODAY);
    expect(after.age).not.toBeNull();
    const p = after.projection!;
    expect(p.summary.loggedDays).toBe(28);
    // 기준값은 저장된 분석 결과의 생체나이와 같다 (같은 입력을 다시 계산)
    const stored = await db.analysisResult.findUniqueOrThrow({
      where: { assessmentId: id },
    });
    expect(p.now.overall!.current).toBe(
      (stored.bioAge as { overall: { age: number } }).overall.age,
    );
    expect(p.now.overall!.delta).toBeLessThan(0);
  });

  it("회원 삭제 시 활동 기록도 함께 삭제된다", async () => {
    await db.user.delete({ where: { id: userId } });
    expect(await db.activityLog.count({ where: { userId } })).toBe(0);
  });
});
