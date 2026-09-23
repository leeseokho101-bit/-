import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "로그인 | 입체적 건강분석" };

export default function LoginPage() {
  return (
    <PageContainer>
      <PageHeader
        title="로그인"
        description="분석 결과를 안전하게 보관하기 위해 로그인이 필요합니다."
      />
      <Placeholder label="개발용 계정 로그인 (이메일 + 비밀번호)" step={4} />
    </PageContainer>
  );
}
