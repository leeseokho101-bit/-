import { StepPage } from "@/components/assessment/step-page";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "복용약 | 입체적 건강분석" };

export default function Page() {
  return (
    <StepPage slug="medications">
      <Placeholder
        label="약 이름 · 복용 목적 · 복용 빈도 (여러 개 추가)"
        step={4}
      />
    </StepPage>
  );
}
