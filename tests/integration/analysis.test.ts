import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { sampleUsers } from "@/dev/samples";
import { resetSampleUser } from "@/dev/seed-sample";
import { runAnalysis } from "@/features/analysis/run";

const db = new PrismaClient();
const EMAIL = "analysis-test@example.invalid";
const sampleC = { ...sampleUsers.find((s) => s.id === "C")!, email: EMAIL };

afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL, isSample: true } });
  await db.$disconnect();
});

describe("runAnalysis (DB)", () => {
  it("저장된 입력으로 분석하고 결과·해시를 저장한다", async () => {
    const userId = await resetSampleUser(db, sampleC, "scrypt$x$y");
    const { id } = await db.assessment.findFirstOrThrow({ where: { userId } });

    const first = await runAnalysis(db, id);
    const stored = await db.analysisResult.findUniqueOrThrow({
      where: { assessmentId: id },
    });
    const assessment = await db.assessment.findUniqueOrThrow({ where: { id } });

    expect(assessment.status).toBe("ANALYZED");
    expect(stored.inputHash).toBe(first.inputHash);
    expect(stored.engineVersion).toBe(first.output.engineVersion);
    expect((stored.priorities as { domain: string }[])[0].domain).toBe(
      "GLYCEMIC",
    );
  });

  it("같은 입력으로 다시 분석하면 해시와 결과가 같다", async () => {
    const { id } = await db.assessment.findFirstOrThrow({
      where: { user: { email: EMAIL } },
    });
    const a = await runAnalysis(db, id);
    const b = await runAnalysis(db, id);
    expect(b.inputHash).toBe(a.inputHash);
    expect(b.output).toEqual(a.output);
  });

  it("입력이 바뀌면 해시가 달라진다", async () => {
    const { id } = await db.assessment.findFirstOrThrow({
      where: { user: { email: EMAIL } },
    });
    const before = await runAnalysis(db, id);
    await db.measurement.update({
      where: { assessmentId_metric: { assessmentId: id, metric: "HBA1C" } },
      data: { value: 5.5 },
    });
    const after = await runAnalysis(db, id);
    expect(after.inputHash).not.toBe(before.inputHash);
  });
});
