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
    if (m.drugCode) defaults[`meds.${i}.drugCode`] = m.drugCode;
    if (m.dailyTablets !== null)
      defaults[`meds.${i}.dailyTablets`] = String(m.dailyTablets);
  });

  return (
    <StepPage slug="medications">
      <Card className="bg-primary/5 border-primary/20 text-sm leading-relaxed">
        복용약 정보는 건강관리 계획과 생체나이 계산에 참고만 합니다.{" "}
        <strong>약에 대한 판단이나 복용 변경을 권하지 않으며</strong>, 약에 관한
        궁금한 점은 의사·약사와 상담해 주세요.
        <br />
        혈압약·당뇨약·고지혈증약은 <strong>성분·함량과 하루 복용 알 수</strong>
        를 알려주시면, 약의 평균적인 효과를 반영해 생체나이를 보정해 드려요.
        복합제는 성분별로 나눠 계산합니다. (약 봉투나 처방전에서 확인할 수
        있어요)
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
