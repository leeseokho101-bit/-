import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "대시보드 | 입체적 건강분석" };

const sections = [
  { label: "건강 한눈에 보기", step: 8 },
  { label: "나의 건강 프로파일", step: 8 },
  { label: "건강관리 우선순위 TOP 3", step: 8 },
  { label: "주요 건강 데이터", step: 8 },
  { label: "12주 건강관리", step: 9 },
  { label: "최근 변화", step: 9 },
];

export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader title="대시보드" description="나의 건강관리 현황입니다." />
      {sections.map((s) => (
        <Placeholder key={s.label} label={s.label} step={s.step} />
      ))}
    </PageContainer>
  );
}
