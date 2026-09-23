import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { LevelDots, StatusBadge } from "@/components/ui/status-badge";
import { domainContent } from "@/content/domains";
import { DOMAIN_CODES } from "@/domain/analysis/types";
import { routes } from "@/lib/routes";

const values = [
  {
    icon: "🧩",
    title: "하나씩이 아니라, 함께 봅니다",
    body: "검진 수치, 생활습관, 복용약 정보를 종합해 10개 건강영역을 살펴봅니다.",
  },
  {
    icon: "🎯",
    title: "지금 먼저 관리할 3가지",
    body: "여러 정보를 함께 고려해 건강관리 우선순위 TOP 3를 알려드립니다.",
  },
  {
    icon: "🗓️",
    title: "12주 실천 계획",
    body: "우선순위에 맞춘 주차별 목표와 실천 항목으로 꾸준한 관리를 돕습니다.",
  },
];

const steps = [
  "기본정보·검진 수치 입력",
  "생활습관·복용약 입력",
  "10개 영역 분석",
  "우선순위와 12주 계획 확인",
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams;
  return (
    <PageContainer>
      {deleted === "1" && (
        <p
          role="status"
          className="border-border bg-surface rounded-xl border px-4 py-3 text-sm"
        >
          ✓ 계정과 모든 건강정보가 삭제되었어요.
        </p>
      )}
      <section className="flex flex-col gap-5 pt-4">
        <p className="text-primary text-sm font-semibold">입체적 건강분석</p>
        <h1 className="text-3xl leading-snug font-bold">
          내 건강을 하나씩 보는 것이 아니라, 전체적으로 분석합니다.
        </h1>
        <p className="text-muted text-lg leading-relaxed">
          건강검진, 생활습관, 복용약 정보를 종합하여 지금 내가 가장 먼저
          관리해야 할 건강영역을 찾아드립니다.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <ButtonLink href={routes.assessment} className="text-lg">
            내 건강 분석하기
          </ButtonLink>
          <p className="text-muted text-center text-sm">
            약 5분 · 모르는 항목은 건너뛰어도 돼요
          </p>
        </div>
      </section>

      {/* 결과 미리보기 (예시) */}
      <Card className="flex flex-col gap-3">
        <p className="text-muted text-sm font-semibold">결과 화면 예시</p>
        {(
          [
            ["METABOLIC", 4, "MANAGEMENT_NEEDED"],
            ["EXERCISE", 4, "MANAGEMENT_NEEDED"],
            ["SLEEP", 3, "ATTENTION"],
          ] as const
        ).map(([code, level, status]) => (
          <div
            key={code}
            className="border-border flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
          >
            <span className="font-semibold">{domainContent[code].label}</span>
            <span className="flex items-center gap-3">
              <LevelDots level={level} />
              <span className="flex w-24 justify-end">
                <StatusBadge status={status} />
              </span>
            </span>
          </div>
        ))}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">무엇이 다른가요?</h2>
        {values.map((v) => (
          <Card key={v.title} className="flex gap-4">
            <span aria-hidden className="text-2xl">
              {v.icon}
            </span>
            <div>
              <h3 className="font-bold">{v.title}</h3>
              <p className="text-muted mt-1 leading-relaxed">{v.body}</p>
            </div>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">이렇게 진행돼요</h2>
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-bold">
                {i + 1}
              </span>
              <span className="font-medium">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">살펴보는 10개 건강영역</h2>
        <ul className="grid grid-cols-2 gap-2">
          {DOMAIN_CODES.map((code) => (
            <li
              key={code}
              className="border-border bg-surface rounded-xl border px-3 py-2.5"
            >
              <p className="font-semibold">{domainContent[code].label}</p>
              <p className="text-muted text-xs">{domainContent[code].short}</p>
            </li>
          ))}
        </ul>
      </section>

      <Card className="bg-background text-muted text-sm leading-relaxed">
        입체적 건강분석은 의학적 진단을 하지 않습니다. 건강관리의 방향을 잡는 데
        참고하시고, 정확한 판단은 의료진과 상담하시기 바랍니다.
      </Card>

      <div className="flex flex-col gap-3">
        <ButtonLink href={routes.assessment}>내 건강 분석하기</ButtonLink>
        <ButtonLink href={routes.about} variant="secondary">
          분석 방법 자세히 보기
        </ButtonLink>
      </div>
    </PageContainer>
  );
}
