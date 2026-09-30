import { z } from "zod";
import {
  IMPORTABLE_CODES,
  type ImportableCode,
} from "@/domain/checkup-import/types";
import { checkupFormSchema, metricNum } from "@/features/assessment/schemas";

/**
 * 판독 결과 확인 폼. 건강검진 단계와 같은 검증(허용 범위·혈압 순서)에
 * 결과표에 함께 있는 키·체중을 더한다. 비워 둔 항목은 저장하지 않는다.
 */
export const confirmImportFormSchema = checkupFormSchema.safeExtend({
  importId: z.string().trim().min(1).max(40),
  HEIGHT: metricNum("HEIGHT").optional(),
  WEIGHT: metricNum("WEIGHT").optional(),
});

export function importedValuesOf(
  d: z.output<typeof confirmImportFormSchema>,
): Partial<Record<ImportableCode, number>> {
  const values: Partial<Record<ImportableCode, number>> = {};
  for (const code of IMPORTABLE_CODES) {
    const v = d[code];
    if (typeof v === "number") values[code] = v;
  }
  return values;
}
