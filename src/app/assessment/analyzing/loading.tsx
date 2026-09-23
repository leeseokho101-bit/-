import { PageHeader } from "@/components/ui/page-header";

const steps = [
  "검진 수치 확인",
  "10개 건강영역 분석",
  "우선순위 정리",
  "쉬운 설명 작성",
];

export default function AnalyzingLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-6"
      role="status"
      aria-live="polite"
    >
      <PageHeader
        title="건강정보를 종합하고 있어요"
        description="검진 수치, 생활습관, 복용약 정보를 함께 살펴보는 중입니다. 잠시만 기다려 주세요."
      />
      <div className="flex justify-center py-6">
        <span
          aria-hidden
          className="border-primary/20 border-t-primary size-14 animate-spin rounded-full border-4"
        />
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s} className="text-muted flex items-center gap-2">
            <span aria-hidden className="text-primary">
              •
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
