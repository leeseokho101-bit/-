import { StepPage } from "@/components/assessment/step-page";
import {
  ChoiceField,
  FormSection,
  NumberField,
} from "@/components/form/controls";
import { StepForm } from "@/components/form/step-form";
import {
  FREQUENCIES,
  frequencyLabels,
  SMOKING_STATUSES,
  smokingLabels,
} from "@/domain/health-snapshot/survey";
import { saveLifestyle } from "@/features/assessment/actions";
import { flattenToFormValues } from "@/features/assessment/form-data";
import { loadStep } from "@/features/assessment/load-step";

export const metadata = { title: "생활습관 | 입체적 건강분석" };

const freqOptions = FREQUENCIES.map((f) => ({
  value: f,
  label: frequencyLabels[f],
}));

const dietQuestions = [
  { key: "breakfast", label: "아침식사를 얼마나 드시나요?" },
  {
    key: "lateNightSnack",
    label: "야식(밤 9시 이후 식사·간식)은 얼마나 드시나요?",
  },
  { key: "eatingOut", label: "외식이나 배달음식은 얼마나 드시나요?" },
  { key: "vegetables", label: "채소 반찬은 얼마나 드시나요?" },
  { key: "fruits", label: "과일은 얼마나 드시나요?" },
  {
    key: "sugaryDrinks",
    label: "단 음료(탄산음료, 달달한 커피 등)는 얼마나 드시나요?",
  },
  {
    key: "processedFood",
    label: "가공식품(라면, 햄, 소시지 등)은 얼마나 드시나요?",
  },
] as const;

export default async function LifestyleStepPage() {
  const { inputs, prevHref } = await loadStep("lifestyle");
  const { diet, alcohol, smoking, stress } = inputs.survey;
  const defaults = flattenToFormValues({ diet, alcohol, smoking, stress });

  return (
    <StepPage slug="lifestyle">
      <StepForm action={saveLifestyle} defaults={defaults} prevHref={prevHref}>
        <FormSection
          title="식습관"
          description="최근 한 달을 기준으로 가장 가까운 것을 골라주세요."
        >
          {dietQuestions.map((q) => (
            <ChoiceField
              key={q.key}
              name={`diet.${q.key}`}
              label={q.label}
              options={freqOptions}
            />
          ))}
        </FormSection>
        <FormSection title="음주">
          <div className="group/alc flex flex-col gap-5">
            <ChoiceField
              name="alcohol.frequency"
              label="술은 얼마나 자주 드시나요?"
              options={freqOptions}
            />
            {/* "안 함" 선택 시 음주량 숨김 (저장 시에도 제외됨) */}
            <div className="group-has-[input[value=NEVER]:checked]/alc:hidden">
              <NumberField
                name="alcohol.drinksPerOccasion"
                label="한 번 마실 때 양"
                unit="잔"
                decimals={1}
                help="소주잔 기준이에요. 맥주 1캔(355mL)은 약 1.5잔으로 계산해 주세요."
                optional
              />
            </div>
          </div>
        </FormSection>
        <FormSection title="흡연">
          <div className="group/smoke flex flex-col gap-5">
            <ChoiceField
              name="smoking.status"
              label="담배를 피우시나요?"
              help="전자담배도 포함해 주세요."
              columns={1}
              options={SMOKING_STATUSES.map((s) => ({
                value: s,
                label: smokingLabels[s],
              }))}
            />
            {/* "현재 피움" 선택 시에만 흡연량 표시 */}
            <div className="hidden group-has-[input[value=CURRENT]:checked]/smoke:block">
              <NumberField
                name="smoking.cigarettesPerDay"
                label="하루 흡연량"
                unit="개비"
                optional
              />
            </div>
          </div>
        </FormSection>
        <FormSection title="스트레스">
          <ChoiceField
            name="stress.level"
            label="최근 느끼는 스트레스는 어느 정도인가요?"
            columns={1}
            options={[
              "거의 없음",
              "조금 있음",
              "보통",
              "많음",
              "매우 많음",
            ].map((label, i) => ({
              value: String(i + 1),
              label,
            }))}
          />
        </FormSection>
      </StepForm>
    </StepPage>
  );
}
