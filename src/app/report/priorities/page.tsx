import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "건강관리 우선순위 TOP 3 | 입체적 건강분석" };

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="지금 먼저 관리할 영역"
        title="건강관리 우선순위 TOP 3"
        description="여러 정보를 종합했을 때 먼저 관리하면 좋은 영역입니다."
      />
      <Placeholder label="우선순위 3개와 이유 설명" step={8} />
    </>
  );
}
