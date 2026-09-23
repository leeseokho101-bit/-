import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "마이페이지 | 입체적 건강분석" };

export default function MyPage() {
  return (
    <PageContainer>
      <PageHeader title="마이페이지" />
      <Placeholder label="내 정보 · 분석 이력" step={8} />
      <Placeholder label="내 데이터 전체 삭제 · 로그아웃" step={8} />
    </PageContainer>
  );
}
