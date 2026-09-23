import { MedicationFields } from "@/components/assessment/medication-fields";
import { StepPage } from "@/components/assessment/step-page";
import { StepForm } from "@/components/form/step-form";
import { Card } from "@/components/ui/card";
import { saveMedications } from "@/features/assessment/actions";
import { loadStep } from "@/features/assessment/load-step";

export const metadata = { title: "복용약 | 입체적 건강분석" };

export default async function MedicationsStepPage() {
  const { inputs, prevHref } = await loadStep("medications");
  const defaults: Record<string, string> = {};
  if (inputs.survey.medicationsNone) defaults.none = "yes";
  inputs.medications.forEach((m, i) => {
    defaults[`meds.${i}.name`] = m.name;
    if (m.purpose) defaults[`meds.${i}.purpose`] = m.purpose;
    if (m.frequency) defaults[`meds.${i}.frequency`] = m.frequency;
  });

  return (
    <StepPage slug="medications">
      <Card className="bg-primary/5 border-primary/20 text-sm leading-relaxed">
        복용약 정보는 건강관리 계획을 세울 때 참고만 합니다.{" "}
        <strong>약에 대한 판단이나 복용 변경을 권하지 않으며</strong>, 약에 관한
        궁금한 점은 의사·약사와 상담해 주세요.
      </Card>
      <StepForm
        action={saveMedications}
        defaults={defaults}
        prevHref={prevHref}
      >
        <MedicationFields />
      </StepForm>
    </StepPage>
  );
}
