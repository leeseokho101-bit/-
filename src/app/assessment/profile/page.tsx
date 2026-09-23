import { StepPage } from "@/components/assessment/step-page";
import {
  ChoiceField,
  FormSection,
  InputField,
  NumberField,
} from "@/components/form/controls";
import { StepForm } from "@/components/form/step-form";
import { METRICS } from "@/domain/health-snapshot/metrics";
import { saveProfile } from "@/features/assessment/actions";
import { loadStep } from "@/features/assessment/load-step";

export const metadata = { title: "기본정보 | 입체적 건강분석" };

export default async function ProfileStepPage() {
  const { inputs, prevHref } = await loadStep("profile");
  const defaults: Record<string, string> = {
    displayName: inputs.displayName,
    ...(inputs.profile && {
      sex: inputs.profile.sex,
      birthDate: inputs.profile.birthDate.toISOString().slice(0, 10),
    }),
  };
  for (const code of ["HEIGHT", "WEIGHT", "WAIST"] as const) {
    if (inputs.metrics[code] !== undefined)
      defaults[code] = String(inputs.metrics[code]);
  }

  return (
    <StepPage slug="profile">
      <StepForm action={saveProfile} defaults={defaults} prevHref={prevHref}>
        <FormSection title="나에 대해">
          <InputField
            name="displayName"
            label="이름 또는 별명"
            maxLength={20}
            autoComplete="nickname"
          />
          <ChoiceField
            name="sex"
            label="성별"
            optional={false}
            options={[
              { value: "MALE", label: "남성" },
              { value: "FEMALE", label: "여성" },
            ]}
          />
          <InputField
            name="birthDate"
            label="생년월일"
            type="date"
            min="1920-01-01"
            help="나이에 따라 참고하는 기준이 달라질 수 있어요."
          />
        </FormSection>
        <FormSection title="체형" description="최근에 잰 값을 입력해 주세요.">
          <NumberField
            name="HEIGHT"
            label="키"
            unit="cm"
            decimals={1}
            placeholder="예: 168"
          />
          <NumberField
            name="WEIGHT"
            label="체중"
            unit="kg"
            decimals={1}
            placeholder="예: 65.5"
          />
          <NumberField
            name="WAIST"
            label="허리둘레"
            unit="cm"
            decimals={1}
            optional
            help={`${METRICS.WAIST.help} 모르면 비워두세요.`}
          />
        </FormSection>
      </StepForm>
    </StepPage>
  );
}
