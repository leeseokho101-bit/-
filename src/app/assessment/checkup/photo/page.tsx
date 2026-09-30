import { StepProgress } from "@/components/assessment/step-progress";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireDraftAssessment } from "@/features/assessment/service";
import { PhotoImport } from "@/features/checkup-import/photo-import";
import { assessmentStepPath, routes } from "@/lib/routes";
import { isCheckupPhotoAvailable } from "@/server/ai/checkup-reader";

export const metadata = { title: "결과표 사진으로 입력 | 입체적 건강분석" };

// 사진 판독(AI 호출)이 수십 초 걸릴 수 있다 — 이 페이지의 Server Action 실행 시간 한도
export const maxDuration = 90;

export default async function CheckupPhotoPage() {
  await requireDraftAssessment(routes.checkupPhoto);
  const backHref = assessmentStepPath("checkup");
  return (
    <>
      <StepProgress slug="checkup" />
      <PageHeader
        title="결과표 사진으로 입력"
        description="건강검진 결과표를 찍으면 수치를 읽어 드려요. 확인한 뒤 저장합니다."
      />
      {isCheckupPhotoAvailable() ? (
        <PhotoImport backHref={backHref} />
      ) : (
        <Card>
          <p className="leading-relaxed">
            지금은 사진 판독을 사용할 수 없어요. 건강검진 화면에서 직접 입력해
            주세요.
          </p>
          <ButtonLink href={backHref} className="mt-4 w-full">
            직접 입력하기
          </ButtonLink>
        </Card>
      )}
    </>
  );
}
