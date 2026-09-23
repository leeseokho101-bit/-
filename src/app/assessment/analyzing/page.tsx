import { ButtonLink } from "@/components/ui/button-link";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "분석 중 | 입체적 건강분석" };

export default async function AnalyzingPage() {
  await requireUser(routes.report);
  return (
    <>
      <PageHeader
        title="입력이 완료되었어요"
        description="검진 수치, 생활습관, 복용약 정보를 함께 살펴볼 준비가 되었습니다."
      />
      <Placeholder
        label="분석 엔진 실행 → 완료 시 결과 화면으로 이동"
        step={6}
      />
      <ButtonLink href={routes.report} className="mt-auto">
        결과 보기 (임시)
      </ButtonLink>
    </>
  );
}
