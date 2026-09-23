import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "건강분석 결과 | 입체적 건강분석" };

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="분석 결과"
        title="건강분석 결과"
        description="나의 건강상태를 한눈에 확인하세요."
      />
      <Placeholder label="건강 한눈에 보기 요약 · TOP 3 미리보기" step={8} />
    </>
  );
}
