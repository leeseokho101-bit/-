import { StepPage } from "@/components/assessment/step-page";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "입력 확인 | 입체적 건강분석" };

export default function Page() {
  return (
    <StepPage slug="review" nextLabel="분석 시작">
      <Placeholder label="입력 내용 요약 및 수정" step={4} />
    </StepPage>
  );
}
