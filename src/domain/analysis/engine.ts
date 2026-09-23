/**
 * Rule-based Health Analysis Engine
 * 순수 함수: 같은 HealthSnapshot → 항상 같은 AnalysisOutput. DB·네트워크·LLM에 의존하지 않는다.
 */
import {
  evaluateCardiovascular,
  evaluateGlycemic,
  evaluateKidney,
  evaluateLiver,
  evaluateMetabolic,
  evaluateWeight,
} from "./evaluators/clinical";
import {
  evaluateDiet,
  evaluateExercise,
  evaluateLifestyle,
  evaluateSleep,
} from "./evaluators/habits";
import { calculatePriorities } from "./priority";
import { RULES_VERSION } from "./rules/thresholds";
import type {
  AnalysisOutput,
  DomainCode,
  DomainResult,
  HealthSnapshot,
} from "./types";

const evaluators: Record<DomainCode, (s: HealthSnapshot) => DomainResult> = {
  WEIGHT: evaluateWeight,
  METABOLIC: evaluateMetabolic,
  CARDIOVASCULAR: evaluateCardiovascular,
  GLYCEMIC: evaluateGlycemic,
  LIVER: evaluateLiver,
  KIDNEY: evaluateKidney,
  EXERCISE: evaluateExercise,
  SLEEP: evaluateSleep,
  DIET: evaluateDiet,
  LIFESTYLE: evaluateLifestyle,
};

export function analyze(snapshot: HealthSnapshot): AnalysisOutput {
  const domains = (Object.keys(evaluators) as DomainCode[]).map((code) =>
    evaluators[code](snapshot),
  );
  return {
    engineVersion: RULES_VERSION,
    domains,
    priorities: calculatePriorities(domains),
    dataGaps: domains
      .filter((d) => d.status === "DATA_INSUFFICIENT")
      .map((d) => d.domain),
  };
}
