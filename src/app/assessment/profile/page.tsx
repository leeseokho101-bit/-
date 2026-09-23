import { StepPage } from "@/components/assessment/step-page";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "기본정보 | 입체적 건강분석" };

export default function Page() {
  return (
    <StepPage slug="profile">
      <Placeholder
        label="이름 · 성별 · 생년월일 · 키 · 체중 · 허리둘레"
        step={4}
      />
    </StepPage>
  );
}
