import { StepPage } from "@/components/assessment/step-page";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "건강검진 | 입체적 건강분석" };

export default function Page() {
  return (
    <StepPage slug="checkup">
      <Placeholder
        label="신체 · 혈압 · 혈당 · 지질 · 간 · 신장 수치"
        step={4}
      />
    </StepPage>
  );
}
