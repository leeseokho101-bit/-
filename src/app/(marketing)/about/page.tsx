import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LevelDots, StatusBadge } from "@/components/ui/status-badge";
import { domainContent, statusContent } from "@/content/domains";
import { DOMAIN_CODES, DOMAIN_STATUSES } from "@/domain/analysis/types";
import { routes } from "@/lib/routes";

export const metadata = { title: "서비스 소개 | 입체적 건강분석" };

const process = [
  {
    title: "정해진 기준으로 분석",
    body: "입력한 수치와 생활습관을 미리 정한 기준에 따라 10개 영역으로 나눠 살펴봅니다. 같은 정보를 입력하면 항상 같은 결과가 나옵니다.",
  },
  {
    title: "여러 정보를 함께 고려해 우선순위 결정",
    body: "여러 수치가 함께 높은지, 생활습관이 어떤지, 입력된 정보가 충분한지를 고려해 먼저 관리하면 좋은 영역 3가지를 고릅니다.",
  },
  {
    title: "AI는 쉬운 설명만 담당",
    body: "AI는 분석 결과를 이해하기 쉬운 말로 풀어 설명하고 실천 계획 작성을 돕습니다. 분석 결과 자체를 바꾸지 않습니다.",
  },
];

const notDo = [
  "질병을 진단하거나 병명을 알려드리지 않습니다.",
  "질병 확률이나 위험도(%)를 계산하지 않습니다.",
  "약의 복용·중단·변경을 권하지 않습니다.",
  "병원 진료를 대신하지 않습니다.",
];

export default function AboutPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="서비스 소개"
        title="어떻게 분석하나요?"
        description="건강검진 수치와 생활습관을 함께 살펴보고, 지금 먼저 관리하면 좋은 영역을 알려드립니다."
      />

      <ol className="flex flex-col gap-3">
        {process.map((p, i) => (
          <li key={p.title}>
            <Card className="flex gap-4">
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold">
                {i + 1}
              </span>
              <div>
                <h2 className="font-bold">{p.title}</h2>
                <p className="text-muted mt-1 leading-relaxed">{p.body}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">결과는 이렇게 표시돼요</h2>
        <p className="text-muted leading-relaxed">
          색상만으로 구분하지 않고, 이름과 점(●)을 함께 보여드립니다. 점이
          많을수록 관리가 더 필요하다는 뜻이에요.
        </p>
        <Card className="flex flex-col gap-3">
          {DOMAIN_STATUSES.map((s) => (
            <div key={s} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <StatusBadge status={s} />
                <LevelDots level={statusContent[s].dots} />
              </div>
              <p className="text-muted text-sm">{statusContent[s].meaning}</p>
            </div>
          ))}
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">살펴보는 10개 건강영역</h2>
        <Card>
          <dl className="divide-border flex flex-col divide-y">
            {DOMAIN_CODES.map((code) => (
              <div key={code} className="py-3 first:pt-0 last:pb-0">
                <dt className="font-semibold">{domainContent[code].label}</dt>
                <dd className="text-muted text-sm leading-relaxed">
                  {domainContent[code].description}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">이런 것은 하지 않아요</h2>
        <Card>
          <ul className="flex flex-col gap-2">
            {notDo.map((t) => (
              <li key={t} className="flex gap-2 leading-relaxed">
                <span aria-hidden className="text-muted">
                  ✕
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Card>
        <p className="text-muted text-sm leading-relaxed">
          입력하신 건강정보는 분석 목적으로만 사용하며, 마이페이지에서 언제든
          삭제할 수 있습니다.
        </p>
      </section>

      <ButtonLink href={routes.assessment}>내 건강 분석하기</ButtonLink>
    </PageContainer>
  );
}
