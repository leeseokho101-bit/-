import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "샘플 데이터 (개발용)" };

export default function DevSamplesPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="개발 전용"
        title="가상 사용자 불러오기"
        description="모든 데이터는 가상의 인물입니다. 실제 개인정보를 사용하지 않습니다."
      />
      <Placeholder label="User A~E 선택 → 분석 결과 확인" step={5} />
    </PageContainer>
  );
}
