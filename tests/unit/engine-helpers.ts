import { analyze } from "@/domain/analysis/engine";
import { buildHealthSnapshot } from "@/domain/analysis/snapshot";
import type { DomainCode, HealthSnapshot } from "@/domain/analysis/types";
import { surveyAnswersSchema } from "@/domain/health-snapshot/survey";
import { sampleUsers, type SampleUser } from "@/dev/samples";

export function snapshotOf(sample: SampleUser): HealthSnapshot {
  return buildHealthSnapshot({
    sex: sample.sex,
    birthDate: new Date(`${sample.birthDate}T00:00:00Z`),
    referenceDate: new Date(`${sample.checkupDate}T00:00:00Z`),
    metrics: sample.metrics,
    survey: sample.survey,
    medicationPurposes: sample.medications.map((m) => m.purpose),
  });
}

export function analyzeSample(id: SampleUser["id"]) {
  return analyze(snapshotOf(sampleUsers.find((s) => s.id === id)!));
}

/** 빈 입력에서 필요한 값만 채운 스냅샷 */
export function snap(partial: {
  sex?: "MALE" | "FEMALE";
  age?: number;
  metrics?: HealthSnapshot["metrics"];
  survey?: Parameters<typeof surveyAnswersSchema.parse>[0];
  managed?: HealthSnapshot["managed"];
}): HealthSnapshot {
  return {
    demographics: { sex: partial.sex ?? "MALE", age: partial.age ?? 50 },
    metrics: partial.metrics ?? {},
    survey: surveyAnswersSchema.parse(partial.survey ?? {}),
    managed: partial.managed ?? [],
  };
}

export function domain(s: HealthSnapshot, code: DomainCode) {
  return analyze(s).domains.find((d) => d.domain === code)!;
}
