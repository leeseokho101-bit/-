/**
 * 판정 근거(messageKey) → 사용자에게 보여줄 쉬운 설명
 * 원칙: 진단명·확률을 쓰지 않고 "범위", "관심", "관리" 표현을 사용한다.
 */
const base: Record<string, string> = {
  // 체중
  "weight.bmi.under": "체질량지수(BMI)가 권장 범위보다 낮은 편이에요.",
  "weight.bmi.normal": "체질량지수(BMI)가 권장 범위 안에 있어요.",
  "weight.bmi.preobese": "체질량지수(BMI)가 권장 범위보다 조금 높은 편이에요.",
  "weight.bmi.obese": "체질량지수(BMI)가 체중관리가 필요한 범위에 있어요.",
  "weight.bmi.obese2":
    "체질량지수(BMI)가 적극적인 체중관리가 필요한 범위에 있어요.",
  "weight.waist.high": "허리둘레가 복부 체중관리가 필요한 범위에 있어요.",
  "weight.waist.borderline": "허리둘레가 기준에 가까워지고 있어요.",
  "weight.waist.normal": "허리둘레가 권장 범위 안에 있어요.",
  // 대사
  "metabolic.waist.hit": "허리둘레가 대사건강 관리 기준에 해당해요.",
  "metabolic.waist.ok": "허리둘레는 대사건강 기준 안에 있어요.",
  "metabolic.bloodPressure.hit": "혈압이 대사건강 관리 기준에 해당해요.",
  "metabolic.bloodPressure.managed":
    "혈압은 현재 관리 중인 항목이라 대사건강 요소에 포함했어요.",
  "metabolic.bloodPressure.ok": "혈압은 대사건강 기준 안에 있어요.",
  "metabolic.glucose.hit": "공복혈당이 대사건강 관리 기준에 해당해요.",
  "metabolic.glucose.managed":
    "혈당은 현재 관리 중인 항목이라 대사건강 요소에 포함했어요.",
  "metabolic.glucose.ok": "공복혈당은 대사건강 기준 안에 있어요.",
  "metabolic.triglyceride.hit": "중성지방이 대사건강 관리 기준에 해당해요.",
  "metabolic.triglyceride.managed":
    "콜레스테롤·중성지방은 현재 관리 중인 항목이라 대사건강 요소에 포함했어요.",
  "metabolic.triglyceride.ok": "중성지방은 대사건강 기준 안에 있어요.",
  "metabolic.hdl.hit": "HDL 콜레스테롤이 대사건강 관리 기준보다 낮아요.",
  "metabolic.hdl.ok": "HDL 콜레스테롤은 대사건강 기준 안에 있어요.",
  "metabolic.count.0": "대사건강 관련 5가지 항목이 모두 기준 안에 있어요.",
  "metabolic.count.1": "대사건강 관련 5가지 항목 중 1가지가 기준에 해당해요.",
  "metabolic.count.2": "대사건강 관련 5가지 항목 중 2가지가 기준에 해당해요.",
  "metabolic.count.3":
    "대사건강 관련 5가지 항목 중 3가지가 함께 기준에 해당해요.",
  "metabolic.count.4":
    "대사건강 관련 5가지 항목 중 4가지가 함께 기준에 해당해요.",
  "metabolic.count.5": "대사건강 관련 5가지 항목이 모두 기준에 해당해요.",
  // 심혈관
  "cardio.bp.high": "혈압이 관리가 필요한 범위에 있어요.",
  "cardio.bp.pre": "혈압이 관심이 필요한 경계 범위에 있어요.",
  "cardio.bp.elevated": "혈압이 정상 범위의 높은 쪽에 있어요.",
  "cardio.bp.normal": "혈압이 권장 범위 안에 있어요.",
  "cardio.ldl.high": "LDL 콜레스테롤이 관리가 필요한 범위에 있어요.",
  "cardio.ldl.borderline": "LDL 콜레스테롤이 경계 범위에 있어요.",
  "cardio.ldl.nearOptimal": "LDL 콜레스테롤이 정상 범위에 있어요.",
  "cardio.ldl.optimal": "LDL 콜레스테롤이 좋은 범위에 있어요.",
  "cardio.tc.high": "총콜레스테롤이 관리가 필요한 범위에 있어요.",
  "cardio.tc.borderline": "총콜레스테롤이 경계 범위에 있어요.",
  "cardio.tc.normal": "총콜레스테롤이 권장 범위 안에 있어요.",
  "cardio.hdl.low": "HDL 콜레스테롤이 권장보다 낮은 편이에요.",
  "cardio.hdl.normal": "HDL 콜레스테롤이 정상 범위에 있어요.",
  "cardio.hdl.good": "HDL 콜레스테롤이 좋은 범위에 있어요.",
  "cardio.smoking.current":
    "현재 흡연은 심장과 혈관 건강 관리에서 중요하게 살펴볼 부분이에요.",
  "cardio.smoking.former": "과거에 흡연했지만 지금은 끊은 상태예요.",
  "cardio.smoking.never": "흡연하지 않아요.",
  // 혈당
  "glycemic.fbg.high": "공복혈당이 관리가 필요한 범위에 있어요.",
  "glycemic.fbg.borderline": "공복혈당이 관심이 필요한 경계 범위에 있어요.",
  "glycemic.fbg.normal": "공복혈당이 권장 범위 안에 있어요.",
  "glycemic.a1c.high": "당화혈색소가 관리가 필요한 범위에 있어요.",
  "glycemic.a1c.borderline": "당화혈색소가 관심이 필요한 경계 범위에 있어요.",
  "glycemic.a1c.normal": "당화혈색소가 권장 범위 안에 있어요.",
  // 간
  "liver.ast.high": "AST 수치가 관리가 필요한 범위에 있어요.",
  "liver.ast.borderline": "AST 수치가 경계 범위에 있어요.",
  "liver.ast.normal": "AST 수치가 정상 범위에 있어요.",
  "liver.alt.high": "ALT 수치가 관리가 필요한 범위에 있어요.",
  "liver.alt.borderline": "ALT 수치가 경계 범위에 있어요.",
  "liver.alt.normal": "ALT 수치가 정상 범위에 있어요.",
  "liver.ggt.high": "감마지티피(γ-GTP) 수치가 관리가 필요한 범위에 있어요.",
  "liver.ggt.borderline": "감마지티피(γ-GTP) 수치가 경계 범위에 있어요.",
  "liver.ggt.normal": "감마지티피(γ-GTP) 수치가 정상 범위에 있어요.",
  // 신장
  "kidney.egfr.low": "사구체여과율(eGFR)이 관리가 필요한 범위에 있어요.",
  "kidney.egfr.mild": "사구체여과율(eGFR)이 정상 범위의 낮은 쪽에 있어요.",
  "kidney.egfr.normal": "사구체여과율(eGFR)이 좋은 범위에 있어요.",
  "kidney.cr.high": "크레아티닌 수치가 관리가 필요한 범위에 있어요.",
  "kidney.cr.normal": "크레아티닌 수치가 정상 범위에 있어요.",
  // 운동
  "exercise.aerobic.enough": "유산소 운동을 권장량(주 150분) 이상 하고 있어요.",
  "exercise.aerobic.some":
    "유산소 운동을 하고 있지만 권장량(주 150분)보다 적어요.",
  "exercise.aerobic.low": "유산소 운동 시간이 권장량보다 많이 적어요.",
  "exercise.aerobic.none": "유산소 운동을 거의 하지 않고 있어요.",
  "exercise.steps.enough": "하루 걸음 수가 충분해요.",
  "exercise.steps.some": "하루 걸음 수가 보통 수준이에요.",
  "exercise.steps.low": "하루 걸음 수가 적은 편이에요.",
  "exercise.steps.veryLow": "하루 걸음 수가 매우 적어요.",
  "exercise.sessions.regular": "주 3회 이상 규칙적으로 운동하고 있어요.",
  "exercise.sessions.some": "운동을 가끔 하고 있어요.",
  "exercise.sessions.none": "규칙적인 운동을 하지 않고 있어요.",
  "exercise.strength.yes": "근력운동을 하고 있어요.",
  "exercise.strength.no": "근력운동을 하지 않고 있어요.",
  // 수면
  "sleep.hours.good": "수면시간이 적당해요.",
  "sleep.hours.slightlyShort": "수면시간이 권장(7~8시간)보다 조금 짧아요.",
  "sleep.hours.slightlyLong": "수면시간이 권장(7~8시간)보다 조금 길어요.",
  "sleep.hours.short": "수면시간이 짧은 편이에요.",
  "sleep.hours.long": "수면시간이 긴 편이에요.",
  "sleep.hours.veryShort": "수면시간이 매우 짧아요.",
  "sleep.satisfaction.optimal": "수면에 만족하고 있어요.",
  "sleep.satisfaction.normal": "수면 만족도가 보통이에요.",
  "sleep.satisfaction.borderline": "수면에 만족하지 못하고 있어요.",
  "sleep.satisfaction.elevated": "수면에 매우 불만족하고 있어요.",
  "sleep.bedtime.good": "잠드는 시간이 적당해요.",
  "sleep.bedtime.slightlyLate": "잠드는 시간이 조금 늦은 편이에요.",
  "sleep.bedtime.late": "잠드는 시간이 늦은 편이에요.",
  // 생활습관
  "lifestyle.smoking.current": "현재 흡연하고 있어요.",
  "lifestyle.smoking.former": "과거에 흡연했지만 지금은 끊었어요.",
  "lifestyle.smoking.never": "흡연하지 않아요.",
  "lifestyle.alcohol.low": "음주가 적은 편이에요.",
  "lifestyle.alcohol.moderate": "음주가 보통 수준이에요.",
  "lifestyle.alcohol.frequent": "술을 자주 마시는 편이에요.",
  "lifestyle.alcohol.highRisk": "음주 빈도와 양이 많은 편이에요.",
  "lifestyle.stress.optimal": "스트레스가 적은 편이에요.",
  "lifestyle.stress.normal": "스트레스가 보통 수준이에요.",
  "lifestyle.stress.borderline": "스트레스가 많은 편이에요.",
  "lifestyle.stress.elevated": "스트레스가 매우 많은 편이에요.",
};

// 식습관 7문항 × 4구간 (조사를 항목별로 지정)
const diet: Record<string, string> = {
  "diet.breakfast.optimal": "아침식사를 잘 챙기고 있어요.",
  "diet.breakfast.normal": "아침식사를 어느 정도 챙기고 있어요.",
  "diet.breakfast.borderline": "아침식사를 자주 거르는 편이에요.",
  "diet.breakfast.elevated": "아침식사를 거의 하지 않아요.",
  "diet.vegetables.optimal": "채소를 매일 챙겨 먹고 있어요.",
  "diet.vegetables.normal": "채소를 어느 정도 먹고 있어요.",
  "diet.vegetables.borderline": "채소 섭취가 부족한 편이에요.",
  "diet.vegetables.elevated": "채소 섭취가 많이 부족해요.",
  "diet.fruits.optimal": "과일을 자주 챙겨 먹고 있어요.",
  "diet.fruits.normal": "과일을 가끔 먹고 있어요.",
  "diet.fruits.borderline": "과일 섭취가 부족한 편이에요.",
  "diet.fruits.elevated": "과일 섭취가 많이 부족해요.",
  "diet.lateNightSnack.optimal": "야식이 적은 편이에요.",
  "diet.lateNightSnack.normal": "야식을 가끔 먹어요.",
  "diet.lateNightSnack.borderline": "야식을 자주 먹는 편이에요.",
  "diet.lateNightSnack.elevated": "야식을 거의 매일 먹어요.",
  "diet.eatingOut.optimal": "외식·배달음식이 적은 편이에요.",
  "diet.eatingOut.normal": "외식·배달음식이 보통 수준이에요.",
  "diet.eatingOut.borderline": "외식·배달음식을 거의 매일 먹어요.",
  "diet.eatingOut.elevated": "외식·배달음식이 매우 잦아요.",
  "diet.sugaryDrinks.optimal": "단 음료를 거의 마시지 않아요.",
  "diet.sugaryDrinks.normal": "단 음료를 가끔 마셔요.",
  "diet.sugaryDrinks.borderline": "단 음료를 자주 마시는 편이에요.",
  "diet.sugaryDrinks.elevated": "단 음료를 거의 매일 마셔요.",
  "diet.processedFood.optimal": "가공식품을 적게 먹는 편이에요.",
  "diet.processedFood.normal": "가공식품을 가끔 먹어요.",
  "diet.processedFood.borderline": "가공식품을 자주 먹는 편이에요.",
  "diet.processedFood.elevated": "가공식품을 거의 매일 먹어요.",
};

export const findingMessages: Record<string, string> = { ...base, ...diet };

export function findingText(messageKey: string): string | undefined {
  return findingMessages[messageKey];
}
