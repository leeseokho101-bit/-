import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";

export const metadata = { title: "12주 건강관리 계획 | 입체적 건강분석" };

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="나만의 실천 계획"
        title="12주 건강관리 계획"
        description="우선순위를 바탕으로 12주 동안 실천할 계획입니다."
      />
      <Placeholder
        label="1~4주 · 5~8주 · 9~12주 단계별 목표·실천·체크·코칭"
        step={9}
      />
    </>
  );
}
