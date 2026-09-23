import { StepPage } from "@/components/assessment/step-page";
import {
  ChoiceField,
  FormSection,
  InputField,
  NumberField,
} from "@/components/form/controls";
import { StepForm } from "@/components/form/step-form";
import { saveExerciseSleep } from "@/features/assessment/actions";
import { flattenToFormValues } from "@/features/assessment/form-data";
import { loadStep } from "@/features/assessment/load-step";

export const metadata = { title: "운동·수면 | 입체적 건강분석" };

const scale5 = (labels: [string, string, string, string, string]) =>
  labels.map((label, i) => ({ value: String(i + 1), label }));

export default async function SurveyStepPage() {
  const { inputs, prevHref } = await loadStep("survey");
  const defaults = flattenToFormValues({
    exercise: inputs.survey.exercise,
    sleep: inputs.survey.sleep,
  });

  return (
    <StepPage slug="survey">
      <StepForm
        action={saveExerciseSleep}
        defaults={defaults}
        prevHref={prevHref}
      >
        <FormSection
          title="운동"
          description="최근 한 달을 기준으로 답해 주세요."
        >
          <NumberField
            name="exercise.sessionsPerWeek"
            label="일주일에 운동하는 횟수"
            unit="회"
            help="땀이 나거나 숨이 찰 정도의 운동을 기준으로 해 주세요."
            optional
          />
          <NumberField
            name="exercise.dailySteps"
            label="하루 평균 걸음 수"
            unit="보"
            help="휴대폰 건강 앱에서 확인할 수 있어요. 모르면 비워두세요."
            placeholder="예: 6000"
            optional
          />
          <NumberField
            name="exercise.aerobicMinPerWeek"
            label="일주일 유산소 운동 시간"
            unit="분"
            help="빠르게 걷기, 자전거, 수영 등을 모두 더한 시간이에요."
            placeholder="예: 90"
            optional
          />
          <ChoiceField
            name="exercise.strengthTraining"
            label="근력운동을 하시나요?"
            help="아령, 기구 운동, 스쿼트, 팔굽혀펴기 등 (주 1회 이상)"
            options={[
              { value: "yes", label: "예" },
              { value: "no", label: "아니요" },
            ]}
          />
        </FormSection>
        <FormSection title="수면">
          <NumberField
            name="sleep.avgHours"
            label="하루 평균 수면시간"
            unit="시간"
            decimals={1}
            placeholder="예: 6.5"
            optional
          />
          <div className="grid grid-cols-2 gap-3">
            <InputField
              name="sleep.bedtime"
              label="보통 잠드는 시간"
              type="time"
              optional
            />
            <InputField
              name="sleep.wakeTime"
              label="보통 일어나는 시간"
              type="time"
              optional
            />
          </div>
          <ChoiceField
            name="sleep.satisfaction"
            label="수면에 얼마나 만족하시나요?"
            columns={1}
            options={scale5([
              "매우 불만족",
              "불만족",
              "보통",
              "만족",
              "매우 만족",
            ])}
          />
        </FormSection>
      </StepForm>
    </StepPage>
  );
}
