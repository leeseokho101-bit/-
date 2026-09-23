import { StepPage } from "@/components/assessment/step-page";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "생활습관 | 입체적 건강분석" };

export default function Page() {
  return (
    <StepPage slug="lifestyle">
      <Placeholder label="식습관 7문항 · 음주 · 흡연 · 스트레스" step={4} />
    </StepPage>
  );
}
