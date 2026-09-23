import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink, buttonBase } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { domainContent } from "@/content/domains";
import { DeleteDataForm } from "@/features/account/delete-form";
import { getReportHistory } from "@/features/analysis/queries";
import { logout } from "@/features/auth/actions";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "마이페이지 | 입체적 건강분석" };

export default async function MyPage() {
  const user = await requireUser(routes.mypage);
  const history = await getReportHistory(user.id);

  return (
    <PageContainer>
      <PageHeader
        title="마이페이지"
        description={`${user.displayName}님, 안녕하세요.`}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">분석 이력</h2>
        {history.length === 0 ? (
          <Card className="text-muted text-sm">아직 분석 이력이 없어요.</Card>
        ) : (
          <ol className="divide-border border-border bg-surface divide-y rounded-2xl border">
            {history.map((h, i) => (
              <li
                key={h.assessmentId}
                className="flex flex-col gap-1 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {h.analyzedAt.toLocaleDateString("ko-KR")}
                    {i === 0 && (
                      <span className="text-primary ml-2 text-xs">최근</span>
                    )}
                  </span>
                  <span className="text-muted text-sm">
                    관리 필요 {h.managementNeeded}개
                  </span>
                </div>
                <p className="text-muted text-sm">
                  {h.topDomains.length
                    ? `우선순위: ${h.topDomains.map((d) => domainContent[d].label).join(" · ")}`
                    : "관리가 필요한 영역 없음 (유지 중심)"}
                </p>
              </li>
            ))}
          </ol>
        )}
        <ButtonLink href={routes.assessment} variant="secondary">
          새로 분석하기
        </ButtonLink>
      </section>

      <Card>
        <p className="text-sm">
          개인정보·건강정보 수집 동의:{" "}
          <span className="font-semibold">
            {user.consentAt
              ? user.consentAt.toLocaleDateString("ko-KR")
              : "미동의"}
          </span>
        </p>
      </Card>

      <form action={logout}>
        <button
          type="submit"
          className={`${buttonBase} border-border bg-surface text-foreground w-full border`}
        >
          로그아웃
        </button>
      </form>

      <details className="border-border bg-surface rounded-2xl border p-5">
        <summary className="cursor-pointer font-semibold text-rose-800">
          내 데이터 삭제
        </summary>
        <div className="mt-4">
          <DeleteDataForm />
        </div>
      </details>
    </PageContainer>
  );
}
