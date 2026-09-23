import { StepPage } from "@/components/assessment/step-page";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "운동·수면 | 입체적 건강분석" };

export default function Page() {
  return (
    <StepPage slug="survey">
      <Placeholder
        label="운동(횟수·걸음수·유산소·근력) · 수면(시간·취침·기상·만족도)"
        step={4}
      />
    </StepPage>
  );
}
