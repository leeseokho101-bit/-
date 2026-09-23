import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "나의 건강 프로파일 | 입체적 건강분석" };

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="10개 건강영역"
        title="나의 건강 프로파일"
        description="각 영역의 현재 상태를 쉬운 말로 알려드립니다."
      />
      <Placeholder label="10개 영역 카드 (상태 라벨 + ●●●○○)" step={8} />
    </>
  );
}
